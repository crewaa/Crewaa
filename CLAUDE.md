# Crewaa — Working Context for Claude

> Written by Claude on 2026-08-10 after a full read of the repository, and updated after the
> hardening pass of the same day. Everything here is derived from the actual code, not from the
> GPT handoff document.
> Confidence labels: **[V]** verified in code · **[I]** inferred · **[?]** unknown.

---

## What Crewaa is

**[V]** Crewaa is an **AI-powered influencer marketing platform** connecting **brands** and **creators (influencers)**.

- Creators sign up, link their Instagram / YouTube handles, and Crewaa scrapes their public stats.
- An AI engine (Google Gemini) analyses creator data to produce a growth report, and matches creators to brands.
- Brands describe a campaign and get an AI-ranked shortlist of creators.
- Creators see the reverse side: **anonymised** brand opportunities (brand identity is stripped and then verified).
- An admin console manages users platform-wide.

Public domain **[V]**: `crewaa.in` / `www.crewaa.in`, plus a Vercel preview `crewaa-m4pz.vercel.app`.

**Three roles [V]:** `BRAND`, `INFLUENCER`, `ADMIN` (stored as an uppercase string on `users.role`
— no enum, no separate roles table). Admins cannot be created via signup; use `seed_admin.py`.

---

## Stack

| Layer | Choice | Evidence |
|---|---|---|
| Frontend | Next.js 16.1.1 (App Router), React 19.2.3, TypeScript, Tailwind v4, shadcn/ui + Radix, framer-motion, recharts | `frontend/package.json` |
| Backend | FastAPI (modular monolith), Python ≥3.11, uvicorn | `backend/pyproject.toml`, `app/main.py` |
| ORM / DB | SQLAlchemy 2.0 async + asyncpg → PostgreSQL (Neon, `us-east-1`) | `app/core/database.py` |
| Migrations | Alembic (`app/migrations`) — 28 revisions, linear, head = `c7a3d84f1e09` | `alembic.ini` |
| Auth | Own JWT (python-jose) + bcrypt/passlib, plus Google Sign-In (ID-token verification) | `app/core/security.py`, `app/modules/auth/` |
| AI | Google Gemini via **`google-genai`** (async client), model from `GEMINI_MODEL` (default `gemini-2.5-flash`) | `app/modules/ai/ai_service.py` |
| Instagram data | Apify actor `apify/instagram-profile-scraper` | `app/modules/instagram/services/apify_client.py` |
| YouTube data | YouTube Data API v3 (direct httpx calls) | `app/modules/youtube/scrapper.py` |
| Rate limiting | In-process fixed-window counter | `app/common/rate_limit.py` |
| Tests / CI | pytest (333 tests) + prompt evals + GitHub Actions | `backend/tests/`, `backend/evals/`, `.github/workflows/ci.yml` |
| Deployment | Frontend on **Vercel**; backend on **Render** (told by Vishal 2026-08-13 — no Render config is in the repo, so the service name, plan and URL are still **[?]**) | — |

---

## Commands

```bash
# Frontend
cd frontend && pnpm install && pnpm dev     # http://localhost:3000
pnpm build      # next build
pnpm lint       # eslint — currently 0 errors, keep it that way

# Backend  (requires Python 3.11+)
cd backend && ./scripts/setup-dev.sh        # recreates .venv, installs deps, writes a starter .env
source .venv/bin/activate
pytest -q                                   # 333 tests
python -m evals.runner                      # prompt evals (offline; --live hits Gemini)
uvicorn app.main:app --reload               # http://localhost:8000
alembic upgrade head                        # safe as of 2026-10-04 (head c7a3d84f1e09)
python seed_admin.py --email you@crewaa.in --password '...'
```

**Note:** the `backend/.venv` committed to this working folder was built inside a Linux sandbox on
Python 3.10 and **will not work on macOS**. Run `./scripts/setup-dev.sh` to rebuild it. It is
gitignored.

CI runs backend tests, a migration schema-drift check, frontend typecheck/lint/build, and a secret
scan.

---

## Repository map

```
backend/
  Dockerfile
  scripts/setup-dev.sh      # recreate .venv + starter .env
  tests/                    # 333 tests, SQLite-backed, no network
  evals/                    # prompt quality suite — see evals/README.md
  app/
    main.py                 # app, CORS from config, request-id middleware, error handler
    core/                   # config, database, security (JWT+bcrypt), logging (loguru)
    common/                 # dependencies.py  = get_db, get_current_user,
                            #                    require_roles, require_self_or_admin
                            # rate_limit.py    = rate_limit (by IP), rate_limit_user (by account)
    models/                 # thin re-export shims so Alembic sees every model — do not delete
    migrations/             # head = c7a3d84f1e09
    modules/
      auth/                 # signup, login, Google OAuth, set-password, logout
      users/                # /users/me, creator profile, brand profile, saved creators
      admin/                # stats, user list/detail/create/delete
      ai/                   # Gemini engines + the 3 AI endpoints  ← the product's core
      instagram/            # Apify scraper, routes, scrape-status
      youtube/              # YouTube Data API scraper, routes, scrape-status
      scraping/             # scrape_jobs model + job bookkeeping (shared by both scrapers)
      campaigns/            # Campaign entity — the brand's offer to anyone
      deals/                # opportunity_interests + offers, deliveries, reviews (offer_router)
      messaging/            # threads anchored on opportunity_interests; reveals the brand
      notifications/        # in-app bell: Notification model, 4 endpoints, notify()
      trust/                # blocks, reports, disputes, manual verification (+ admin_router)
      health/               # GET /health (verifies the database)
frontend/
  app/
    (landing-page)/         # marketing site: home, contact, privacy, terms
    (auth)/                 # login, signup (role picker → brand/influencer), set-password
    (app)/                  # authenticated dashboards
      dashboard/
        influencer/         # Creator Studio → deals, growth-analyzer
        brand/              # Brand Studio → discover
        admin/              # admin console → users, users/[id], trust (reports/disputes/verifications)
        messages/           # thread list + messages/[interestId] (terms, delivery, reviews, safety)
        analytics/          # influencer (IG/YT tabs) + brand (saved creators)
        profile/            # creator profile form
        brand-profile/      # brand profile form
  components/               # dashboard widgets, landing-page sections, ui/ (shadcn)
  lib/                      # axios instance (ApiError), types.ts, typed API clients
```

---

## Data model (15 owned tables + 4 scraped tables)

`users` is the hub; everything cascades from it.

- **`users`** — `id`, `email` (unique), `hashed_password` (nullable → Google-only users), `role`, `is_active` (now enforced), `instagram_username` (legacy/duplicated, unused), `token_version` (refresh-token revocation), and the four `verification_*` columns.
- **`creator_profiles`** — 1:1 with a user. Identity, IG/YT handles, `bio`, plus **AI result cache**: `ai_summary`, `cached_brand_deals` (both **JSONB** on PostgreSQL) and their `*_generated_at` timestamps.
- **`brand_profiles`** — 1:1 with a user. `target_languages` / `platform_preferences` are **JSON-encoded strings in TEXT columns**, not JSONB.
- **`saved_creators`** — brand↔creator join, written as a side effect of the AI discovery run. **Unique on `(brand_id, creator_id)`.**
- **`notifications`** — recipient, kind, stored title/body/link, optional `interest_id`. Text and link are **stored, not derived**: a notification records what was true when it fired.
- **`user_blocks`** — one row per direction, unique on the pair. A block in *either* direction stops messages *both* ways.
- **`user_reports`** — reporter, reported, reason, status, reviewing admin. The reported person is never notified.
- **`deal_disputes`** — one **open** dispute per interest, enforced by the partial unique index `uq_deal_disputes_one_open`.
- **`scrape_jobs`** — one row per scrape attempt: platform, status, user-facing message, timings.
- **`instagram_profiles` / `instagram_posts`** — append-only snapshots keyed by `user_id` + `scraped_at`.
- **`youtube_channels` / `youtube_videos`** — upsert by `(user_id, channel_id)`; videos replaced on re-scrape.

Full detail in `docs/03-domain-model.md`.

---

## Critical rules for working on this repo

> A hardening pass was completed on 2026-08-10 — `docs/08-hardening-log.md` records exactly what
> changed and why. The rules below are the invariants it established.

1. **Never restore the original body of migration `dd173ce633c3`.** It was titled "Add caching columns" but dropped the `saved_creators` table. It is now a documented no-op, and `b7e4c1a90f22` recreates the table idempotently. `alembic upgrade head` is safe.
2. **Never commit a connection string or API key.** `alembic.ini` reads `DATABASE_URL` from the environment. CI has a secret scan that fails the build. ⚠️ **The previously leaked Neon password still needs rotating and remains in git history.**
3. **Every non-public endpoint needs an auth dependency.** `tests/test_authorization.py::test_no_endpoint_is_unintentionally_public` fails the build otherwise. Use `require_self_or_admin` for `{user_id}` routes and `require_roles(...)` for role gates — not inline `if current_user.role != ...` checks (several older handlers still do this; migrate them opportunistically).
4. **Anything that spends money must be rate-limited per user account**, not per IP — scrapes (Apify) and AI calls (Gemini). See `app/common/rate_limit.py`.
5. **Before changing any prompt, run `python -m evals.runner --live --repeat 3` before and after.** The offline run in CI only proves the pipeline works; it cannot see quality move. See `backend/evals/README.md`.
6. **Brand anonymity is enforced by `scrub_brand_identity()`, not by the prompt.** If you touch `ANONYMOUS_OPPORTUNITY_PROMPT`, keep the scrubbing in the path — it is the actual guarantee behind the Brand Deals feature.
7. **All model-facing data is untrusted.** Scraped bios and captions are attacker-controlled; keep them inside the fenced data blocks.
8. **Never block the event loop from an async handler.** Apify goes through `run_in_threadpool`; Gemini uses the `google-genai` async client. **bcrypt counts too** — it is ~180ms of CPU, so handlers must use `hash_password_async` / `verify_password_async`, never the sync forms. Running it inline froze every other request on the worker.
9. **Use `logger` from `app/core/logging.py`, never `print()`.** loguru uses `{}` placeholders with positional args: `logger.info("scraping {} for {}", name, uid)`. `diagnose=False` is deliberate so secrets never land in a traceback.
10. **Always use the shared `get_db`** from `app/common/dependencies.py`. A duplicate local copy in `auth/router.py` previously made those routes invisible to dependency overrides.
11. **Frontend route protection is client-side only** (`useEffect` → `getCurrentUser()` → `router.replace`). It is a UX guard. The server is the only real boundary.
12. **The access token lives in `localStorage`; the refresh token does not.** The access token is
    attached by an axios interceptor and is script-readable, which is tolerable because it expires
    in minutes. The refresh token is an **httpOnly cookie** — putting it in `localStorage` would
    turn one XSS bug into weeks of access. On a 401 the interceptor calls `/auth/refresh` once,
    single-flight, and replays the request; only if that fails does the user land on `/login`.
13. **Run `pytest -q` before pushing.** 333 tests, ~100 seconds. `python -m evals.runner` is part of CI too.
14. **Never invent facts about this project.** Where the docs say **[?]**, the repository does not answer the question — ask Vishal or check the running system.
15. **Deal offers are immutable and at most one may be accepted per interest.** Countering writes a new `deal_offers` row via `supersedes_id`; it never edits the old one. The single-acceptance rule is enforced by the partial unique index `uq_deal_offers_one_accepted`, not just by the handler. Nobody may respond to their own offer. `commission_rate_pct` is null by design until payment ships, and must then be **snapshotted at acceptance** so a rate change cannot rewrite an agreed deal.
16. **Delivery and reviews have asymmetric roles, and both are evidence.** The creator submits, the brand reviews; neither may do the other's job. Delivery submissions are immutable (resubmitting supersedes) because a timestamp nobody can edit is what settles "you never posted it". Reviews are **double-blind** — neither side sees the other's until both submit or `REVIEW_REVEAL_DAYS` passes — and hidden reviews are excluded from public counts and averages, since an average that shifts on submission leaks what was said. Deal completion is **derived from submissions, never stored**.
17. **Pin every third-party SDK to a major version, and test the client boundary.** `apify-client` was unpinned; version 3 changed `actor.call()` from returning a `dict` to a `Run` model, a Render redeploy silently upgraded it, and production Instagram imports failed for weeks with `'Run' object is not subscriptable` **while Apify kept succeeding and charging**. No test caught it because `test_scraping.py` mocks the layer *above* the SDK. `apify-client` and `google-genai` are now pinned `<4` / `<3`, and `tests/test_apify_client.py` + `tests/test_gemini_client.py` exercise each client boundary against a fake shaped like the real SDK.
18. **Never report our own failure as the user's problem.** `app/modules/scraping/errors.py` splits failures into `ScrapeConfigurationError` (ours), `ProfileNotFoundError` (theirs) and `ScrapeUpstreamError` (the provider's). A single catch-all is what told creators "your account may be private" during an outage caused by our own parsing bug — and pointed the investigation at Instagram for weeks.
19. **Preserve the spelling `Crewaa`** in prose, code, titles and metadata. The *logo* is
    deliberately a lowercase `crewaa` wordmark — that is the drawn lockup in
    `frontend/public/crewaa-logo-dark.svg`, not a typo to be corrected. Brand assets live in
    `brand/`; the app only ever references the copies under `frontend/public` and `frontend/app`.
    Use `crewaa-logo-dark.svg` on dark surfaces (every surface today), `crewaa-logo.svg` on light
    ones. `next/image` needs `unoptimized` for these: Next's optimizer rejects SVG unless
    `dangerouslyAllowSVG` is enabled globally, which we do not want.
20. **Every token is signed with the same secret, so `type` is what distinguishes them.**
    `get_current_user` requires `type == "access"` — checked positively, so a token with no
    `type` fails closed too. A refresh token must never authenticate a request (it would turn a
    weeks-long cookie into a session credential), and an access token must never be redeemable
    at `/auth/refresh` (a token stolen from localStorage would renew itself forever). Refresh
    tokens carry a `jti`: without it the payload is determined by `(sub, ver, exp)` and `exp`
    has one-second resolution, so rotation silently returned a byte-identical token.
21. **`users.token_version` is what makes logout mean anything.** Bumping it invalidates every
    refresh token outstanding for that account. Clearing the cookie alone does nothing to a copy
    someone already took off a shared machine. Setting a password bumps it too.
22. **`notify()` stages on the caller's session and never commits.** The notification and the
    event it describes must land in the same transaction, or a creator can be told "you have a
    new offer" for an offer whose own commit then failed. Notifications go to whoever did *not*
    act, via `counterpart_id()`. The review notification must never mention the rating — that
    would walk straight through the double-blind in rule 16.
23. **Trust & safety records are evidence, like delivery and reviews.** Blocking does not delete
    or hide the conversation; reporting does not edit it; a dispute changes nothing about the
    delivery or the agreed terms. A block in *either* direction stops messages *both* ways —
    a one-way block is a mute button that still lets you shout. The reported person is never
    notified, now or on review. Verification is a **signal, not a gate**: nothing is restricted
    to verified accounts, because gating discovery on it would delist every existing creator.
24. **After `await db.rollback()`, never touch an ORM attribute you did not read first.** The
    rollback expires every object in the session, so a later `current_user.id` triggers a lazy
    reload outside the async context and raises `MissingGreenlet` — turning a harmless duplicate
    into a 500. Capture the ids before the write (see `trust/router.py`).
25. **Crewaa is dark-only, and `<html>` carries a pinned `dark` class.** `globals.css` defines
    the variant as `&:is(.dark *)` and `:root` sets a *white* `--background`, so without that
    class ~48 `dark:` utilities silently stop applying. `next-themes` is gone; do not reintroduce
    a runtime theme without building light mode properly.
26. **Before any `git push`, read the checklist at the top of `ACTION-REQUIRED.md` and surface
    it to Vishal first.** He asked to be reminded at push time about setting `SENTRY_DSN` on
    Render and `NEXT_PUBLIC_SENTRY_DSN` on Vercel. Both hosts have a way of accepting the
    variable while continuing to run without it, so "I added it" is not the same as "it took
    effect".

---

## Known gaps (real, not yet addressed)

> Re-verified against the code on 2026-08-13. Items fixed in later passes have been removed:
> error tracking, Instagram snapshot retention, AI cache staleness, and the campaign entity
> plus expression of interest all now exist.

| Item | Notes |
|---|---|
| **Neon password not yet rotated** | The only outstanding security action. Steps in `docs/08-hardening-log.md`. Still present in git history. |
| **Sentry DSNs not set on Vercel/Render** | Code and local `.env` are done; production still reports nothing until the host env vars are added. See the checklist at the top of `ACTION-REQUIRED.md`. |
| Refresh cookie is cross-site | Implemented 2026-10-04. Works, but `crewaa.in` → `onrender.com` makes it a third-party cookie, which Safari blocks by default. It degrades to the old behaviour (bounced to `/login`) rather than breaking. Real fix: serve the API from `api.crewaa.in`. See `ACTION-REQUIRED.md` §1d. |
| Background tasks are still in-process | **Deferred to V3** (Vishal, 2026-10-04). A deploy still kills an in-flight scrape, mitigated by the stuck-job sweeper. arq+Redis was costed: Render background workers have no free tier ($7/mo floor), and the spend was judged premature before there is transaction volume. `REDIS_URL` stays read-but-unused. |
| Email notifications | The in-app bell exists (§2.1); email does not. Anything time-sensitive still depends on someone opening the app. Needs a transactional provider (Resend/Postmark/SES) and a domain verified by DNS. |
| Marketplace loop stops at payment | Campaigns → opportunities → interest → **messaging (§1.1)** → **negotiated terms (§1.2)** → **delivery (§1.4)** → **two-way reviews (§1.5)** all exist. The one remaining gap is **money**: no payment or escrow, so Crewaa records a completed deal it cannot yet take a commission on. Blocked on compliance — see `VERSION-2-PLAN.md` §1.3. |
| Frontend route protection is client-side only | By design — the server is the real boundary — but worth remembering when reading the dashboard code. |

---

## Environment variables

Backend (`backend/.env`, gitignored — `app/core/config.py` is the source of truth):

| Name | Required | Purpose |
|---|---|---|
| `APP_NAME` | yes | FastAPI title |
| `ENV` | yes | environment label; `dev`/`local` enables DEBUG logging |
| `DATABASE_URL` | yes | `postgresql+asyncpg://...` — TLS and pool pre-ping are applied automatically |
| `JWT_SECRET_KEY` | yes | signs access + setup tokens |
| `JWT_ALGORITHM` | yes | e.g. `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | yes | access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | yes | refresh-token lifetime and the cookie's `max-age` |
| `GOOGLE_CLIENT_ID` | yes | Google ID-token audience check |
| `APIFY_TOKEN` | no | Instagram scraping; feature disabled when blank |
| `YOUTUBE_API_KEY` | no | YouTube Data API v3 |
| `GEMINI_API_KEY` | no | Gemini — AI features fail without it |
| `GEMINI_MODEL` | no | default `gemini-2.5-flash` |
| `GEMINI_TIMEOUT_SECONDS` | no | default 60 |
| `AI_MAX_CREATORS_PER_PROMPT` | no | default 40 |
| `AI_MAX_BRANDS_PER_RUN` | no | default 12 |
| `AI_MAX_CONCURRENT_CALLS` | no | default 4 |
| `AI_CACHE_STALE_AFTER_DAYS` | no | default 14; past this a cached AI result is shown as stale |
| `REVIEW_REVEAL_DAYS` | no | code constant (14) in `deals/reviews.py`, not env — how long a review stays hidden awaiting the other side |
| `SCRAPE_TTL_DAYS` | no | default 90; Instagram snapshot retention. 0 disables pruning |
| `REDIS_URL` | no | **read but unused.** The documented target for arq (V2 §2.2) and for a Redis-backed rate limiter. Both deferred to V3 — see `VERSION-2-PLAN.md` |
| `BCRYPT_ROUNDS` | no | default 12; lower to 11/10 if sign-in feels slow. Existing passwords keep working |
| `LOGIN_MAX_FAILURES` | no | default 8 failed sign-ins per email+IP before a temporary lockout |
| `LOGIN_FAILURE_WINDOW_SECONDS` | no | default 900 |
| `CORS_ORIGINS` | no | comma-separated; defaults to localhost + the crewaa.in domains |
| `SENTRY_DSN` | no | error tracking; **blank disables it entirely** |
| `SENTRY_ENVIRONMENT` | no | defaults to `ENV` |
| `SENTRY_RELEASE` | no | optional version marker (a git sha) |
| `SENTRY_TRACES_SAMPLE_RATE` | no | default `0.0` — tracing is billed separately from errors |

The first eight have no defaults — the backend refuses to boot without them.
Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and optionally
`NEXT_PUBLIC_SENTRY_DSN`.

**Never re-enable Sentry's frame locals.** `include_local_variables=False` and
`send_default_pii=False` in `app/core/observability.py` are the reason a crash cannot ship
the Neon password or an API key to a third party — the same reason loguru runs with
`diagnose=False` (rule 8). `tests/test_observability.py` fails the build if either leaks.

---

## Deeper documentation

- `docs/01-product.md` — what the product does, personas, user journeys
- `docs/02-architecture.md` — runtime architecture and request flows
- `docs/03-domain-model.md` — tables, relationships, migration history
- `docs/04-api.md` — every endpoint, with auth status
- `docs/05-ai-system.md` — Gemini engines, prompts, caching, cost/latency
- `docs/06-frontend.md` — routes, components, state and auth handling
- `docs/07-risks-and-gaps.md` — the original findings, with current status
- `docs/08-hardening-log.md` — what changed on 2026-08-10 and what is still open
