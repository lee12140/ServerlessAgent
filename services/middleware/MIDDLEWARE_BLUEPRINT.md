# Middleware Refactor — Implementation Blueprint

## Goal

Replace the single-file `index.ts` with a properly encapsulated module structure.
Each concern lives in its own file with a clear, single responsibility.
No business logic in `index.ts` — it is a wiring layer only.

> **Scope:** Text messages only. Voice/transcriber is out of scope for this middleware.

---

## Target File Structure

```
services/middleware/src/
  index.ts              # Lambda entry point — wires auth, router, gateway
  router.ts             # Route dispatch table — maps method+path to handlers
  auth.ts               # Per-user API key lookup + userId resolution
  handlers/
    text.ts             # POST /webhook (text message)
  gateways/
    agent.ts            # AgentGateway interface + LambdaAgentGateway impl
    users.ts            # UserGateway interface + DynamoUserGateway impl
  models/
    requests.ts         # Validated request types (TextRequest)
    responses.ts        # Canonical response shapes + error codes
  utils/
    http.ts             # json() response builder, extractBody()
    decode.ts           # decodeLambdaPayload<T>()
```

---

## User Authentication — Per-User API Keys

Authentication uses per-user API keys stored in DynamoDB. There is no shared `API_KEY` env var — every user has their own key. The middleware resolves the key to a `userId` on every request.

### How it works

1. Client sends `x-api-key: OC-<user-specific-key>` header
2. `auth.ts` calls `UserGateway.resolve(apiKey)` → looks up key in DynamoDB
3. On match: returns `{ userId, active }` — request proceeds with `userId` injected
4. On no match or `active: false`: returns `403 Forbidden`

### DynamoDB user record shape

```
PK: "user#<apiKey>"
userId: string       // stable user identifier (e.g. "lee", "guest1")
active: boolean      // set to false to revoke access without deleting
createdAt: string    // ISO timestamp
```

Stored in the existing session table using a `user#` key prefix — no new table needed.

### `auth.ts` — Per-user key validation

```typescript
export interface AuthResult {
  userId: string;
}

// Returns AuthResult on success, APIGatewayProxyResultV2 (403) on failure
export async function validateApiKey(
  event: APIGatewayProxyEventV2,
  users: UserGateway
): Promise<AuthResult | APIGatewayProxyResultV2>
```

- Extracts `x-api-key` header
- Calls `users.resolve(apiKey)`
- Returns `{ userId }` on success so the router can pass it downstream
- No `API_KEY` env var — key lives in DynamoDB only

### `gateways/users.ts` — User lookup abstraction

```typescript
export interface ResolvedUser {
  userId: string;
  active: boolean;
}

export interface UserGateway {
  resolve(apiKey: string): Promise<ResolvedUser | null>;
}

export class DynamoUserGateway implements UserGateway {
  // Uses DynamoDBDocumentClient.send(GetCommand) with key "user#<apiKey>"
  // Reads TABLE_NAME from env — validated at construction time
}
```

### `index.ts` updated wiring

```typescript
const users = new DynamoUserGateway();
const agent = new LambdaAgentGateway();

export const handler = async (event: APIGatewayProxyEventV2) => {
  const auth = await validateApiKey(event, users);
  if ('statusCode' in auth) return auth;           // 403 short-circuit
  return router.route(event, auth.userId, { agent });
};
```

---

## Responsibility Map

### `router.ts` — Route dispatch
- Builds a lookup key from `method + path` (e.g. `"POST /webhook"`)
- Calls the matching handler with `userId` already resolved — handlers never touch auth
- Returns 404 if no match
- Receives gateways as a dependency injection parameter — no direct imports of Lambda clients

```typescript
interface Gateways {
  agent: AgentGateway;
}

export async function route(
  event: APIGatewayProxyEventV2,
  userId: string,
  gateways: Gateways
) { ... }
```

---

### `handlers/text.ts` — POST /webhook
- Parses and validates body via `parseTextRequest()`
- Receives `userId` from the router — does not perform any auth
- Calls `gateways.agent.call(message, sessionId, userId)`
- Returns canonical success response
- Enforces: message required, max 4000 chars, sessionId fallback to UUID

---

### `gateways/agent.ts` — Agent abstraction

```typescript
export interface AgentGateway {
  call(message: string, sessionId: string, userId: string): Promise<AgentResponse>;
}

export class LambdaAgentGateway implements AgentGateway {
  // Uses LambdaClient.send(InvokeCommand) internally
  // Reads AGENT_FUNCTION_NAME from env — validated at construction time, throws at cold start if missing
}
```

---

### `models/requests.ts` — Request shapes

```typescript
export interface TextRequest {
  message: string;     // required, max 4000 chars
  sessionId: string;   // defaulted to UUID if absent
}
// userId is NOT in the request body — it comes from the resolved API key
```

---

### `models/responses.ts` — Canonical response shapes + error codes

All errors use a consistent shape:
```typescript
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
}

export type ErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'MESSAGE_REQUIRED'
  | 'MESSAGE_TOO_LONG'
  | 'INVALID_CONTENT_TYPE'
  | 'INTERNAL_ERROR';
```

Success response includes `requestId` for traceability:
```typescript
export interface TextSuccessResponse {
  message: string;
  sessionId: string;
  requestId: string;
}
```

---

### `utils/http.ts` — HTTP helpers

```typescript
// Typed response builder
export function json(statusCode: number, body: object): APIGatewayProxyResultV2

// Safe body extractor — returns null on malformed JSON instead of throwing
export function extractBody(raw: string | undefined): Record<string, unknown> | null
```

---

### `utils/decode.ts` — Lambda payload decoder

```typescript
// Decodes Uint8Array Lambda response, throws on Lambda-level error
export function decodeLambdaPayload<T>(payload: Uint8Array): T
```

---

## Request Flow

```
POST /webhook
  → validateApiKey(event, users)    [auth.ts]        → DynamoDB user lookup
  → router.route(event, userId)     [router.ts]
  → handleText(event, userId)       [handlers/text.ts]
      → extractBody()               [utils/http.ts]
      → parseTextRequest()          [models/requests.ts]
      → agent.call()                [gateways/agent.ts]
  ← TextSuccessResponse             [models/responses.ts]
```

---

## Env Vars Required

| Variable | Validated by | Notes |
|---|---|---|
| `TABLE_NAME` | `DynamoUserGateway` constructor | Same table as agent session memory — uses `user#` key prefix |
| `AGENT_FUNCTION_NAME` | `LambdaAgentGateway` constructor | Throws at cold start if missing |
| `REGION` | Both gateways | Defaults to `eu-central-1` |

> `API_KEY` is removed from `.env.example` and all Lambda config — keys live in DynamoDB only.

---

## Implementation Order

```
1. utils/http.ts        — no dependencies, start here
2. utils/decode.ts      — no dependencies
3. models/responses.ts  — no dependencies
4. models/requests.ts   — no dependencies
5. gateways/users.ts    — depends on utils/decode.ts (DynamoDB lookup)
6. auth.ts              — depends on gateways/users.ts, models/responses.ts
7. gateways/agent.ts    — depends on utils/decode.ts
8. handlers/text.ts     — depends on gateways/agent.ts, models/*
9. router.ts            — depends on handlers/text.ts
10. index.ts            — final wiring, replaces current implementation
```

---

## What Gets Removed

These exist in the current `index.ts` and are either relocated or deleted outright.

| What | Current location | Action |
|---|---|---|
| `callAgent()` function | `index.ts` | Replaced by `LambdaAgentGateway.call()` in `gateways/agent.ts` |
| `decodeLambdaPayload<T>()` | `index.ts` | Moved to `utils/decode.ts` |
| `json()` helper | `index.ts` | Moved to `utils/http.ts` |
| `AgentResponse` interface | `index.ts` | Moved to `models/responses.ts` |
| Inline body parsing & validation | `index.ts` handler body | Moved to `handlers/text.ts` + `models/requests.ts` |
| Inline API key check | `index.ts` handler body | Replaced by `auth.ts` + DynamoDB lookup |
| `source: "text"` in response | `index.ts` | Removed — hardcoded leftover from when voice existed |
| `MAX_MESSAGE_LENGTH` constant | `index.ts` | Moved to `models/requests.ts` alongside the validation that uses it |
| `API_KEY` env var | `.env.example` + Lambda config | Removed — per-user keys stored in DynamoDB instead |

---

## Constraints

- ESM project — all imports must use `.js` file extensions
- Strict TypeScript — `noUncheckedIndexedAccess` is on, no implicit `any`
- No new npm dependencies — use only what is already in `package.json`
- Each file must be independently testable (no side effects at module level except gateway env var guards)
