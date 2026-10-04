# Crewaa — API Surface

> Every endpoint registered in `backend/app/main.py`, verified at commit `5e58465`.
> Base URL comes from `NEXT_PUBLIC_API_URL` on the frontend. Local default `http://localhost:8000`.
> There is **no API versioning** and **no OpenAPI customisation** — FastAPI's auto-docs at `/docs` are live and unprotected **[V]**.

Auth column: **None** = no dependency at all · **JWT** = `get_current_user` · **JWT+role** = plus an inline role check.

---

## Auth — `/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | None | Create BRAND/INFLUENCER. Rejects `role="ADMIN"`. Returns `{access_token, role}` + sets the refresh cookie |
| POST | `/auth/login` | None | Email+password → access token + refresh cookie |
| POST | `/auth/google` | None | Verify Google ID token → login, or return a 10-min `setup_token`. The cookie is set **only** on a completed sign-in |
| POST | `/auth/set-password` | setup_token in body | Set password for a Google-created account → access token + refresh cookie |
| POST | `/auth/refresh` | refresh cookie | Exchange the cookie for a new access token, rotating the cookie |
| POST | `/auth/logout` | refresh cookie (optional) | 204 always. Bumps `users.token_version`, revoking every outstanding refresh token |

Notes:
- **Token types are enforced.** Every token is signed with the same secret, so `get_current_user`
  requires `type == "access"` — checked positively, so a token with no `type` fails closed. A
  refresh token cannot authenticate a request, and an access token cannot be redeemed at
  `/auth/refresh`.
- **Refresh tokens rotate on every use** and carry a `jti`. Without the `jti` the payload is
  determined by `(sub, ver, exp)` and `exp` has one-second resolution, so two refreshes in the
  same second produced a byte-identical token — rotation that rotates nothing.
- **Revocation is `users.token_version`**, not a denylist. One increment kills every refresh token
  for that account across every device. Setting a password bumps it too.
- `/auth/refresh` is in `PUBLIC_PATHS` in `tests/test_authorization.py` — necessarily, since its
  whole purpose is to work once the access token has expired. It is not unauthenticated: it
  requires a valid, unrevoked cookie.
- The cookie is `httpOnly`, with `secure`/`samesite` driven by `ENV`. In production it is a
  **cross-site** cookie (`crewaa.in` → `onrender.com`), which Safari blocks by default; it
  degrades to the old bounce-to-`/login` rather than breaking. See `ACTION-REQUIRED.md` §1d.
- Email is normalised (`lower()`) on both signup and login, and login lockout counts **failures
  only**, per email+IP.

---|---|---|---|
| POST | `/auth/signup` | None | Create BRAND/INFLUENCER. Rejects `role="ADMIN"`. Returns `{access_token, token_type, role}` |
| POST | `/auth/login` | None | Email+password → access token |
| POST | `/auth/google` | None | Verify Google ID token → login, or return a 10-min `setup_token` |
| POST | `/auth/set-password` | setup_token in body | Set password for a Google-created account → access token |
| POST | `/auth/logout` | None | 204. Deletes a `refresh_token` cookie **that is never set**. Effectively a no-op |

Notes:
- `/auth/signup` **[V] calls the DB twice** — it creates the user, then immediately calls `authenticate_user()` to log them in, re-running a bcrypt verify against the password it just hashed. Wasteful but correct.
- `/auth/signup` **[V] has no password strength requirement, no email verification, and no rate limit.**
- **[V] There is no refresh-token endpoint.** `REFRESH_TOKEN_EXPIRE_DAYS` is configured and unused. When the access token expires the user is silently bounced to `/login`.

---

## Users — `/users`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users/me` | JWT | Current user `{id, email, role}` |
| POST | `/users/creator-profile` | JWT + INFLUENCER | Create profile; **fires a background Instagram scrape** if `instagram_username` present |
| GET | `/users/creator-profile` | JWT + INFLUENCER | Own profile |
| PUT | `/users/creator-profile` | JWT + INFLUENCER | Update own profile; re-triggers Instagram scrape |
| ~~GET~~ | ~~`/users/creator-profile/{user_id}`~~ | — | **REMOVED** 2026-08-10 (was unauthenticated) |
| ~~PUT~~ | ~~`/users/creator-profile/{user_id}`~~ | — | **REMOVED** 2026-08-10 (was unauthenticated; anyone could overwrite any profile) |
| POST | `/users/brand-profile` | JWT + BRAND | Create brand profile |
| GET | `/users/brand-profile` | JWT + BRAND | Own brand profile |
| PUT | `/users/brand-profile` | JWT + BRAND | Update own brand profile |
| GET | `/users/saved-creators` | JWT + BRAND | Rows from the last discovery run, joined to creator name/category/platform |

✅ **Both `{user_id}` variants were deleted in the 2026-08-10 hardening pass.** They took no authentication dependency at all; the PUT allowed an anonymous caller to rewrite any creator's name, location, category and social handles — and changing `instagram_username` also redirected that creator's scraping. Neither had a live consumer. The authenticated `/users/creator-profile` routes cover the same use case, and admins can read any creator via `GET /admin/users/{id}`.

---

## Instagram — `/instagram` ✅ secured 2026-08-10

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/instagram/scrape/{user_id}` | JWT + self-or-admin | Queue a background Apify scrape. Returns 200 immediately, always — even for a nonexistent user |
| GET | `/instagram/analytics/{user_id}` | JWT + self-or-admin | Latest profile snapshot + up to 15 posts from that snapshot |

Both routes previously took no authentication: anyone could enumerate every creator's analytics by incrementing `user_id`, and burn Apify credits by hammering the scrape endpoint. They now use `require_self_or_admin`. **There is still no rate limit and no per-user cost cap** — an authenticated user can call scrape repeatedly.

**[V] The response never reports scrape failure.** `scrape_and_store` returns error dicts that FastAPI discards (background task return values go nowhere), and errors are only `print()`ed. The client polls `/analytics` and gives up.

---

## YouTube — `/youtube` ✅ secured 2026-08-10

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/youtube/scrape/{user_id}` | JWT + self-or-admin | Background YouTube Data API scrape (now opens its own DB session) |
| GET | `/youtube/analytics/{user_id}` | JWT + self-or-admin | Latest channel + up to 15 videos |

Previously open, with the same exposure as Instagram plus a quota-exhaustion vector: each scrape costs ~100+ units against a default 10,000/day budget, so ~100 anonymous requests could exhaust the day **[I]**. The session leak into the background task is also fixed.

---

## AI — `/ai`

| Method | Path | Auth | Purpose | Gemini calls |
|---|---|---|---|---|
| GET | `/ai/creator-summary` | JWT + INFLUENCER | Cached summary, or `null` | 0 |
| POST | `/ai/creator-summary` | JWT + INFLUENCER | Generate + cache growth analysis | 1 |
| POST | `/ai/discover-creators` | JWT + BRAND | Rank creators; upsert into `saved_creators` | 1 |
| GET | `/ai/brand-deals` | JWT + INFLUENCER | Cached opportunities, or `null` | 0 |
| POST | `/ai/brand-deals` | JWT + INFLUENCER | Generate opportunities across **all** brands | **1 per brand** |
| POST | `/ai/brand-deals/stream` | JWT + INFLUENCER | Same run, NDJSON, one card per line | **1 per brand** |

Error contract **[V]**:
- `403` wrong role · `404` profile missing · `429` Gemini quota/rate limit · `500` any other AI failure.
- ✅ The `500` path no longer echoes raw upstream exception text; the detail is logged server-side and the client receives a generic message (fixed 2026-08-10).
- `POST /ai/brand-deals` **swallows per-brand failures silently** (`except Exception: print(...); continue`), so a partial result is indistinguishable from a complete one.

`POST /ai/brand-deals/stream` emits NDJSON, one JSON object per line:
`{"type":"opportunity","opportunity":{...}}` repeatedly, then `{"type":"done","total":N,
"generated_at":"..."}`. Late failures arrive as `{"type":"error","detail":"..."}` because once
the body has started there is no status code left to change. It shares `_assess_opportunities`
and `_public_opportunities` with the batch endpoint, so anonymity and real-terms handling cannot
drift between the two. Both write the same cache, so `GET /ai/brand-deals` replays either.

Both brand-deal endpoints order campaigns by the creator's own `category` first, then by
recency. The run is capped at `AI_MAX_BRANDS_PER_RUN`, so this decides what a creator sees at
all — not just the order.

`POST /ai/discover-creators` takes **either** `campaign_id` **or** `niche`; a body with neither is
a `422`. With `campaign_id` the server reads niche, goal, location, platforms and `min_followers`
from that campaign and **ignores** the loose fields entirely — a stale form value can never
redirect a campaign's search. A campaign owned by another brand returns `404`, matching
`/campaigns`, so its existence is not disclosed. The response echoes `criteria_source`
(`"campaign"` / `"custom"`), `campaign_id`, `campaign_name` and `follower_floor_relaxed`.

Response shapes are in `backend/app/modules/ai/schemas.py` and mirrored as TS types in the frontend pages (not in `lib/ai.ts`, which is untyped).

---

## Admin — `/admin` ✅ properly guarded

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/stats` | JWT + ADMIN | Counts by role |
| GET | `/admin/users` | JWT + ADMIN | Paginated list; `role`, `search`, `page`, `page_size` |
| GET | `/admin/users/{id}` | JWT + ADMIN | Detail incl. profile fields |
| POST | `/admin/users` | JWT + ADMIN | Create BRAND/INFLUENCER only |
| DELETE | `/admin/users/{id}` | JWT + ADMIN | Cascade delete; refuses to delete an ADMIN |

This is the only module using a proper `Depends(require_admin)` dependency rather than inline checks **[V]** — it is the pattern the rest of the codebase should follow.

**[V] Minor bug in `list_users` search:** the filter builds `User.id == int(search) if search.isdigit() else False`, passing a bare Python `False` into `or_()`. SQLAlchemy coerces it to `false`, so it works, but it is accidental — an explicit `sqlalchemy.false()` would be correct.

**[V] N+1 in `list_users`:** one extra `COUNT` query per user per page to compute `has_profile`.

**[V] `page`/`page_size` are unvalidated** — `page_size=100000` is accepted, `page=0` produces a negative offset and a database error.

---

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | None | Executes `SELECT 1`. Returns `{"status":"ok","database":"ok"}`, or 503 `{"status":"degraded"}` if the DB is unreachable. (Was a static payload that reported healthy during a total outage — fixed 2026-08-10.) |

---

## Cross-cutting

- **CORS [V]:** fixed allowlist of 5 origins in `main.py` (localhost:3000, 127.0.0.1:3000, the Vercel preview, crewaa.in, www.crewaa.in) with `allow_credentials=True` and `allow_methods/headers=["*"]`. Adding an environment requires a code change and redeploy.
- **No rate limiting, no request-size limit, no idempotency, no pagination outside `/admin/users`, no webhooks, no streaming/SSE/WebSocket.**
- **Error format** is FastAPI's default `{"detail": ...}`; the frontend axios interceptor reads `error.response.data.detail` and rethrows a plain `Error` **[V]** — which means the original HTTP status is discarded before it reaches the UI, so pages cannot distinguish a 429 from a 500.

---

### Deal terms (V2 §1.2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/deals/{interest_id}/terms` | JWT + party to the interest | Current offer, agreed offer, history, and what this viewer may do |
| POST | `/deals/{interest_id}/terms` | JWT + party | Propose or counter. Countering supersedes the live offer rather than editing it |
| POST | `/deals/{interest_id}/terms/{offer_id}/accept` | JWT + **recipient only** | Agrees the terms. Irreversible |
| POST | `/deals/{interest_id}/terms/{offer_id}/decline` | JWT + recipient only | Does not close the negotiation — either side may propose again |
| POST | `/deals/{interest_id}/terms/{offer_id}/withdraw` | JWT + **proposer only** | Pull your own offer back before a response |

A caller who is not one of the two parties gets **404**, not 403 — the existence of someone
else's negotiation is not disclosed, matching `/campaigns` and `/messages`.

Responding to an offer that is no longer live returns **409** with a reload instruction; that
covers the stale-tab case where the other side countered while the page was open.

**Invariants worth knowing before changing this:**
- Nobody may accept or decline their own offer, or a brand could manufacture an agreement the
  creator never saw.
- At most one accepted offer per interest, enforced by the partial unique index
  `uq_deal_offers_one_accepted` rather than by the handler's read-then-write check.
- No commission is calculated or returned. See `app/modules/deals/offers.py`.

### Delivery (V2 §1.4)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/deals/{interest_id}/delivery` | JWT + party | Progress against the agreed terms |
| POST | `/deals/{interest_id}/delivery` | JWT + **creator only** | Submit a link for one agreed deliverable. Resubmitting supersedes |
| POST | `/deals/{interest_id}/delivery/{delivery_id}/review` | JWT + **brand only** | Approve, or request changes (a reason is required) |

Roles are asymmetric on purpose: a brand submitting its own deliverable, or a creator approving
their own, would make the record worthless as proof anything happened. Submissions are immutable.
Completion is **derived** in `delivery_state()`, never stored.

### Reviews (V2 §1.5)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/deals/{interest_id}/review` | JWT + party | Your review always; theirs only once revealed |
| POST | `/deals/{interest_id}/review` | JWT + party | One per person per deal, only after delivery is complete |
| GET | `/deals/reviews/user/{user_id}` | JWT | Public track record — **revealed reviews only** |

**Double-blind.** A review is hidden until both sides submit or `REVIEW_REVEAL_DAYS` (14) pass.
A hidden review is deliberately indistinguishable from one that was never written, and hidden
reviews are excluded from public counts and averages — otherwise an average that moves on
submission leaks its contents.

---

## Notifications — `/notifications` (V2 §2.1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications` | JWT | Most recent 30, newest first |
| GET | `/notifications/unread-count` | JWT | Counts in SQL — polled by the navbar bell every 45s |
| POST | `/notifications/read` | JWT | Mark all read; opening the bell is what "read" means |
| POST | `/notifications/{id}/read` | JWT | Scoped to the caller **in the query**, so someone else's id is a 404 |

Raised by `notify()` on five events: a new message, an offer proposed/countered, an offer
accepted/declined, a delivery submitted/reviewed, and a review submitted.

- `notify()` **stages on the caller's session and never commits.** The notification and the event
  must land in one transaction, or someone is told about an offer whose own commit then failed.
- Notifications go to whoever did **not** act, resolved by `counterpart_id()`.
- Message notifications **collapse**: a burst on one thread updates the existing *unread* entry
  rather than adding rows. Read notifications are never collapsed into — something already seen
  must not change under the reader.
- The review notification deliberately **never mentions the rating**; that would walk straight
  through the double-blind.

---

## Trust & safety — `/trust` (V2 Phase 3)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/trust/block/{interest_id}` | JWT + party | `{blocked, blocked_by_me}` |
| POST | `/trust/block` | JWT + party | Blocking twice is a success, not an error |
| POST | `/trust/unblock` | JWT + party | Lifts **your own** block only |
| POST | `/trust/report` | JWT + party | Returns `{received: true}` and nothing else |
| GET | `/trust/disputes/{interest_id}` | JWT + party | Both sides see a dispute raised against them |
| POST | `/trust/disputes/{interest_id}` | JWT + party | 409 if one is already open |
| GET | `/trust/verification` | JWT | Your own status |
| POST | `/trust/verification` | JWT | Request review; allowed again after a rejection |

- A block in **either** direction stops messages **both** ways. A one-way block is a mute button
  that still lets you shout.
- Blocking never hides or deletes the thread — that conversation is the evidence for any report
  about it, and a block that erased messages would let you unsay things.
- The reported person is **never** notified, now or on review.
- Report and block are separate actions. Bundling them means whoever cannot afford to end a deal
  never reports at all.
- A dispute changes **nothing** about the delivery record or the agreed terms.
- Verification is a **signal, not a gate** — nothing is restricted to verified accounts.

---

## Admin trust queues — `/admin/trust` (V2 Phase 3)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/trust/reports` | ADMIN | Filter by `?status=`, **oldest first** |
| GET | `/admin/trust/reports/counts` | ADMIN | Badge counts across all three queues |
| POST | `/admin/trust/reports/{id}` | ADMIN | reviewed / actioned / dismissed |
| GET | `/admin/trust/disputes` | ADMIN | Filter by `?status=`, oldest first |
| POST | `/admin/trust/disputes/{id}` | ADMIN | Resolve or dismiss — **a written outcome is required** |
| GET | `/admin/trust/verifications` | ADMIN | Pending queue, oldest first |
| POST | `/admin/trust/verifications/{user_id}` | ADMIN | Approve, or reject **with a reason** |

Oldest-first is deliberate: newest-first buries whatever has waited longest, which is the item
most likely to concern someone still being harmed. Every resolution records the acting admin.
