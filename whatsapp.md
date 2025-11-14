## WhatsApp Bot - Implementation Status and Next Steps

### Overview

The Procur WhatsApp bot enables sellers/farmers to sign up, upload products, post harvests, respond to requests with quotes, manage orders, and check transactions directly from WhatsApp. The backend is NestJS (`procur-api`) using the WhatsApp Business Platform (Cloud API), Supabase (DB + Storage), and Redis (sessions/queues/cache).

### Current Features (Implemented)

- **Webhook + Verification**

  - GET `whatsapp/webhook` verifies with `WHATSAPP_VERIFY_TOKEN`
  - POST `whatsapp/webhook` receives inbound messages (public route)
  - HMAC signature verification using `WHATSAPP_APP_SECRET`

- **Session + Flow**

  - In-memory sessions (with TTL); Redis-backed implementation scaffolded, and Redis is used for idempotency and media caching now
  - Menu-driven flows for:
    - Signup (WhatsApp-native, OTP verification, Farmer ID image → private bucket)
    - Product upload (name, price, photo; default lb)
    - Harvest post (crop, window, quantity, unit, notes)
    - Requests & quotes (list requests, create quotes)
    - Orders (list, accept/reject, update status + tracking)
    - Transactions (list recent, check by ID)
  - “Undo last step” support and language picker (en/es) for menu prompts

- **WhatsApp Sending**

  - Outbound messages via BullMQ queue/worker; retries with backoff and DLQ behavior
  - Token refresh: reads latest token from config; publishes token to Redis (`wa:token`); worker re-reads and retries on 401 (code 190)
  - Interactive UI: buttons and list messages (safe truncation for list row titles/descriptions)

- **Templates**

  - Code-based templates (`templates/whatsapp.json`) and a sync script (`scripts/wa-templates.ts`)
  - OTP (`otp_verify`) and order updates: `order_update_with_tracking`, `order_update_no_tracking` (en_US/es_ES)
  - OTP sending logic: uses template outside 24h, text inside 24h
  - GitHub Action workflow to apply templates automatically on push/dispatch

- **Media + Storage**

  - WhatsApp media downloaded via Graph; uploaded to Supabase Storage
  - Product images to public; Farmer ID to private bucket
  - Media bytes short-term cached in Redis

- **AI/RAG (Phase 3)**

  - `ai_embeddings` table + vector index; hybrid search RPC (`search_ai_embeddings_hybrid`) adds FTS blending
  - AiService: embeddings, hybrid search, RAG answer with citations, Redis answer caching
  - Structured extractors for product/harvest/quote/order
  - Moderation gate (OpenAI) for free-text before parsing
  - Global FAQs (`templates/faq.json`) and seed script (`scripts/ai-seed-faq.ts`) – stored with `org_id = null` and included in searches
  - Free-text handling in WhatsApp service: attempts to parse and complete/prefill flows and falls back to prompts if confidence is low

- **Error Handling**
  - Idempotency on inbound (skip duplicate message IDs)
  - Graceful retries on WhatsApp token expiry
  - Template send error logging with Graph error code/subcode

### Environment Variables

- WhatsApp:
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
  - For template sync: `WHATSAPP_WABA_ID` and a token with `whatsapp_business_management`
- Supabase:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Storage: `SUPABASE_PRIVATE_BUCKET` (default `private`)
- Redis:
  - `REDIS_URL` (for queue/worker and caching)
- OpenAI:
  - `OPENAI_API_KEY`

### How To Run Template Sync

- Add to `procur-api/.env` (or set `ENV_FILE`):
  - `WHATSAPP_WABA_ID`, `WHATSAPP_TOKEN`
- Commands (from `procur-api/`):
  - `npm run templates:list`
  - `npm run templates:apply`
  - `npm run templates:delete -- <name> [language]`

### How To Seed Global FAQs

- Add to `procur-api/.env`:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- Command (from `procur-api/`):
  - `npm run ai:seed:faq`
  - Optionally override env path: `ENV_FILE=../.env npm run ai:seed:faq`

### Phase Summary

- **Phase 1 (Reliability) – Done**

  - Webhook + signature verify; idempotency; media caching; base flows; menu
  - Token retry; robust WhatsApp sends; UI buttons/lists

- **Phase 2 (UX/Flows) – Done**

  - Pagination for lists; price confirmation and date validation
  - Templates wired for OTP and order updates (outside 24h); CI workflow for templates
  - Localization baseline (menu/settings and key prompts); Undo

- **Phase 3 (AI/RAG) – Done**
  - Hybrid search + caching; extractors + moderation; global FAQ seeding
  - Free-text parsing integrated into WhatsApp flows with safe fallbacks

### What’s Missing / Next Phases

- **Phase 4 (Security, Compliance, Persistence) – Next**

  - Migrate `SessionStore` to Redis-backed async store; update all session get/set calls
  - “DELETE MY DATA” workflow: queue job, soft-delete account/org, revoke tokens, purge sensitive storage pointers; audit trail
  - Persist opt-out in DB and suppress proactive sends across channels
  - Rate limits/IP allowlist on webhook (edge or API layer)
  - Signed private media URLs with short TTL + access logging

- **Phase 5 (Observability & Analytics) – Next**

  - Sentry integration (API + worker); structured JSON logs with flow tags
  - Prometheus metrics: WA send rates/errors, queue latency, RAG cache hit rate, flow step latencies
  - Funnel events for signup/product/harvest/quote/order/transaction

- **Phase 6 (Ops, Scale & Tests) – Next**
  - Health/readiness checks with dependency probes (Redis, Supabase)
  - Horizontal scaling runbook; disaster recovery and backups
  - Contract tests for WA payloads; E2E for main flows; record/replay fixtures

### Runbook Highlights

- Token Rotation

  - Update `WHATSAPP_TOKEN` in config or write to Redis `wa:token`. Worker reads the latest before every send and on 401 retries with the latest.

- Webhook Issues

  - Ensure `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` are correct
  - 403 on invalid signature (expected)

- Template Errors
  - Check Graph error code/subcode; if category mismatch persists, script will version the name (`_v2`); re-run `templates:apply`
  - Outside 24h: OTP/Order updates must use templates; inside 24h: text sends are allowed

### Notes

- Global FAQ rows (`org_id = null`) are included in searches alongside org-scoped rows after the migrations that: (1) drop NOT NULL on `org_id` and (2) update RLS and search RPCs.
