# Middleware — Developer Guide

## What the Middleware Does

The middleware is the single entry point for all incoming requests to the Serverless Agent.
It sits between API Gateway and the Agent Lambda. Its three responsibilities are:

1. **Authenticate** the request — resolve the API key to a user
2. **Route** the request to the correct handler
3. **Proxy** the call to the Agent Lambda and return the response

No business logic lives here. The middleware does not know what the agent does.

---

## File Structure

```
src/
  index.ts              # Lambda entry point — wires everything together
  auth.ts               # Resolves x-api-key header to a userId
  router.ts             # Dispatches method + path to the correct handler
  handlers/
    text.ts             # Handles POST /webhook (text messages)
  gateways/
    agent.ts            # Calls the Agent Lambda (interface + implementation)
    users.ts            # Looks up users in DynamoDB (interface + implementation)
  models/
    requests.ts         # TextRequest type + parseTextRequest() validation
    responses.ts        # All response shapes and error codes
  utils/
    http.ts             # json() response builder + extractBody() JSON parser
    decode.ts           # Decodes raw Lambda response payloads
```

---

## Request Flow

Every request follows this exact path:

```
API Gateway
  → index.ts          (1) validate API key → get userId
  → router.ts         (2) match method + path → pick handler
  → handlers/text.ts  (3) parse + validate body → call agent
  → gateways/agent.ts (4) invoke Agent Lambda → decode response
  ← json 200/400/403  (5) return structured response to client
```

If auth fails at step 1, the request stops there — the router and handler are never reached.

---

## Authentication — How Per-User API Keys Work

There is no shared `API_KEY` environment variable. Every user has their own key stored in DynamoDB.

**DynamoDB record shape:**
```
PK:        "user#<apiKey>"
userId:    "lee"           ← stable identifier passed to the agent
active:    true            ← set to false to revoke access without deleting
createdAt: "2026-04-10T..."
```

**What happens on each request:**
1. `auth.ts` reads the `x-api-key` header
2. Calls `DynamoUserGateway.resolve(apiKey)` — looks up `user#<apiKey>` in DynamoDB
3. If no record found, or `active === false` → returns `403 Forbidden`
4. If found and active → returns `{ userId }` which flows into the handler

**To add a new user:** insert a record into DynamoDB with the `user#` prefix key.
**To revoke access:** set `active: false` on their record — no redeploy needed.

---

## File-by-File Explanation

### `index.ts`
The Lambda handler. Instantiates the gateways once at cold start (not per request),
runs auth, and delegates to the router. Contains no logic of its own.

```
cold start → new LambdaAgentGateway(), new DynamoUserGateway()
per request → validateApiKey() → route()
```

---

### `auth.ts`
Extracts `x-api-key` from the request headers and resolves it to a `userId` via the
`UserGateway`. Returns either an `AuthResult` (success) or a `403` response object (failure).

The caller in `index.ts` uses `'userId' in auth` to distinguish the two — if `userId`
is present, auth passed; otherwise the response is returned directly.

---

### `router.ts`
Maps `method + path` to a handler function. Currently handles one route:

| Method | Path       | Handler         |
|--------|------------|-----------------|
| POST   | /webhook   | handleText()    |

Any other combination returns `404 Not Found`. Gateways are passed in as a parameter
so the router never imports the AWS SDK directly.

---

### `handlers/text.ts`
Handles `POST /webhook`. Responsible for:
1. Parsing the request body (delegates to `extractBody`)
2. Validating the parsed body (delegates to `parseTextRequest`)
3. Calling the agent gateway with `message`, `sessionId`, and `userId`
4. Building and returning the success response

The `userId` arrives from the router — this handler never touches auth.

---

### `gateways/agent.ts`
Abstracts the Agent Lambda behind an interface:

```typescript
interface AgentGateway {
  call(message: string, sessionId: string, userId: string): Promise<AgentResponse>;
}
```

`LambdaAgentGateway` implements this using the AWS SDK `InvokeCommand`.
The handler only knows about `AgentGateway` — it has no knowledge of Lambda invocation.

---

### `gateways/users.ts`
Abstracts DynamoDB user lookup behind an interface:

```typescript
interface UserGateway {
  resolve(apiKey: string): Promise<ResolvedUser | null>;
}
```

`DynamoUserGateway` implements this using `GetCommand` with key `user#<apiKey>`.
Auth only knows about `UserGateway` — it has no knowledge of DynamoDB.

---

### `models/requests.ts`
Defines `TextRequest` and `parseTextRequest()`. The parser returns either a valid
`TextRequest` or an error code string (`'MESSAGE_REQUIRED'` | `'MESSAGE_TOO_LONG'`).
The `MAX_MESSAGE_LENGTH` constant (4000) lives here alongside the validation that uses it.

---

### `models/responses.ts`
Single source of truth for all response shapes:
- `ErrorResponse` — `{ error: string, code: ErrorCode }`
- `TextSuccessResponse` — `{ message, sessionId, requestId }`
- `AgentResponse` — the shape the Agent Lambda returns

All error codes are defined as a union type (`ErrorCode`) so TypeScript enforces valid codes.

---

### `utils/http.ts`
Two pure helper functions with no side effects:
- `json()` — builds an `APIGatewayProxyStructuredResultV2` with the correct headers
- `extractBody()` — safely parses a JSON string, returns `null` instead of throwing

---

### `utils/decode.ts`
Decodes the raw `Uint8Array` payload returned by Lambda invocations.
If the Lambda itself crashed, it returns `{ errorMessage: "..." }` — this function
detects that and throws so the error propagates cleanly.

---

## Environment Variables

| Variable | Required by | Purpose |
|---|---|---|
| `TABLE_NAME` | `DynamoUserGateway` | DynamoDB table — same table as agent session memory |
| `AGENT_FUNCTION_NAME` | `LambdaAgentGateway` | Name of the Agent Lambda to invoke |
| `REGION` | Both gateways | AWS region, defaults to `eu-central-1` |

Both gateways validate their required env var at construction time and throw immediately
at cold start if it is missing — rather than failing silently on the first request.

---

## Example Request

```bash
curl -X POST https://<api-url>/webhook \
  -H "x-api-key: OC-your-personal-key" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is on my calendar today?", "sessionId": "work"}'
```

**Success response (200):**
```json
{
  "message": "You have a team standup at 09:00 and a client call at 14:00.",
  "sessionId": "work",
  "requestId": "abc-123-def"
}
```

**Auth failure (403):**
```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

**Validation failure (400):**
```json
{
  "error": "Request body must include \"message\".",
  "code": "MESSAGE_REQUIRED"
}
```
