# ServerlessAgent — Current State & Next Steps

## What's been built

A fully deployed, serverless AI personal assistant on AWS Lambda. The agent is production-ready for personal use.

---

## Current State

### Infrastructure
- [x] API Gateway HTTP API with rate limiting (10 req/s, burst 20)
- [x] Three Docker Lambda functions: Middleware, Agent, Transcriber
- [x] Three DynamoDB tables: session memory, notes, expenses
- [x] S3 bucket for voice audio (1-day lifecycle rule)
- [x] AWS Secrets Manager for sensitive credentials
- [x] Scoped IAM policies — least-privilege per Lambda
- [x] TTL on transcription job entries (auto-expire after 1 hour)
- [x] CDK stacks with proper dependency chain (DB → Lambda → API)

### Agent
- [x] ReAct loop (think → act → observe, up to 8 iterations)
- [x] Conversation memory persisted in DynamoDB (trimmed to last 20 turns)
- [x] Self-contained skill registry — adding a skill requires editing 2 files only
- [x] Secrets loaded from AWS Secrets Manager at cold start, cached per container

### Skills (14 total)
- [x] `get_current_time` — current date/time in Europe/Berlin
- [x] `create_calendar_meeting` — schedule Google Calendar events
- [x] `read_calendar_events` — list upcoming events
- [x] `web_search` — DuckDuckGo real-time search
- [x] `get_news` — latest headlines by topic
- [x] `get_weather` — current weather + forecast (OpenWeatherMap)
- [x] `send_email` — send email via Gmail API
- [x] `calculate` — safe math expression evaluator
- [x] `currency_exchange` — real-time rates via frankfurter.app
- [x] `fetch_url_content` — read and summarize any HTTPS URL
- [x] `set_note` / `get_note` — personal notes in DynamoDB
- [x] `log_expense` / `get_expenses` — expense tracking with category totals

### Voice (async transcription)
- [x] Client submits audio → gets `jobId` immediately (no timeout)
- [x] Transcriber runs in background via async Lambda invocation
- [x] Client polls `GET /status/{jobId}` until complete
- [x] Atomic state transitions prevent double agent invocation

---

## Known Limitations

| Limitation | Impact | Fix (see Next Steps) |
|---|---|---|
| No user profile / long-term memory | Agent forgets facts after 20 turns | Layer 1: User Profile |
| No episodic summary | Full history sent to Bedrock every turn — growing cost | Layer 2: Episodic Summary |
| Static system prompt | Agent knows nothing about user until told | Dynamic prompt from profile |
| Single session per user | No topic separation, no multi-thread | Named session IDs |
| No session TTL | Old abandoned sessions never expire | Add TTL to session saves |
| 20-turn working memory | Too large once profile + summary exist | Reduce to 5 turns |

---

## Next Steps

### Step 1 — User Profile (highest value, ~2h)

Add permanent memory of who the user is. The agent will remember name, timezone, preferences, and contacts indefinitely — not just for the current session.

**What to build:**
- `profile#<userId>` DynamoDB item in the session table
- `update_profile` skill — agent calls this when it learns something new
- `loadUserProfile()` function in `dynamo-memory.ts`
- Dynamic system prompt that injects the profile on every turn

**Skill to add:**
```typescript
// services/agent/src/skills/update-profile.ts
export const updateProfileSkill: Skill = {
  definition: {
    name: 'update_user_profile',
    description: "Persist a fact about the user permanently (name, timezone, preferences, contacts). Call when you learn something the user would expect you to always remember.",
    ...
  },
  execute: (input) => updateProfile(input),
};
```

**System prompt addition:**
```
9. USER PROFILE: When you learn a permanent fact about the user, call update_user_profile immediately.
   Always read the profile section above before making assumptions about the user's timezone or preferences.
```

---

### Step 2 — Session TTL (~15 min)

Old conversations should expire automatically. Without this, DynamoDB fills up indefinitely.

In `dynamo-memory.ts`, add to the `save()` call:
```typescript
ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
```

The `timeToLiveAttribute: 'ttl'` is already configured on the session table in CDK.

---

### Step 3 — Episodic Summary (~3h)

Compress old conversation turns into a short paragraph instead of discarding them blindly. This keeps Bedrock context small and cheap while preserving important history.

**Two approaches:**

**Option A — Inline (simpler):** When `trimMessages()` is about to discard old turns, first summarize them with a Bedrock call and store the result in `summary#<userId>`.

**Option B — Scheduled Lambda (cleaner):** Add an EventBridge cron rule that runs a `summarizer` Lambda nightly. It reads all recently updated sessions, summarizes them with Bedrock, and writes the summary back.

Once this is in place, reduce `MAX_TURNS` from 20 to 5 in `dynamo-memory.ts`.

---

### Step 4 — Read Profile Skill (~30 min)

The agent should be able to retrieve its own knowledge about the user on demand.

```typescript
export const getProfileSkill: Skill = {
  definition: {
    name: 'get_user_profile',
    description: "Read all permanently stored facts about the user.",
    ...
  },
};
```

---

### Step 5 — Multi-thread Sessions (optional, ~1h)

Allow the client to maintain separate conversation threads for different contexts (work, personal, etc.).

Currently: `sessionId` defaults to a random UUID per client.
Enhancement: let the client pass a named session: `"sessionId": "work"` vs `"sessionId": "personal"`.

No server-side changes needed — the middleware already echoes `sessionId` back. The client just needs to persist and reuse named IDs.

---

### Step 6 — `read_profile` in System Prompt (after Step 1)

Once the user profile exists, inject it dynamically into the system prompt before every Bedrock call:

```typescript
// In agent.ts runAgentTurn():
const profile = await memory.loadProfile(userId);
const systemPrompt = buildSystemPrompt(profile); // replaces static SYSTEM_PROMPT constant
```

This makes the agent feel genuinely personalised from the first message of any new conversation.

---

## Priority Order

```
1. Session TTL              ← 15 min, prevents DynamoDB bloat, do this first
2. User Profile             ← biggest UX improvement, agent feels smart
3. Dynamic system prompt    ← depends on User Profile
4. Read Profile skill       ← depends on User Profile
5. Episodic Summary         ← reduces cost, improves long-term context
6. Multi-thread sessions    ← quality of life, easy to add
```

---

## Deployment Checklist

Before each `cdk deploy`:

- [ ] `ServerlessAgent/credentials` secret exists in Secrets Manager with current values
- [ ] `API_KEY` is set in your shell environment
- [ ] `ALLOWED_ORIGIN` is set if you want to restrict CORS
- [ ] Docker is running
- [ ] `CODE_VERSION` bumped in `lambda-stack.ts` to force Lambda image refresh
