# Crewaa — Version 2 Plan

> Written by Claude on 2026-08-22, reviewed and decided by Vishal the same day. All six open
> questions below are resolved. **Nothing is started.** Per Vishal's explicit instruction,
> implementation does not begin on any Phase 1 item — not even a "first slice" — until he
> separately says to start, regardless of how settled the plan itself is.
> Grounded in the actual V1 codebase and the two audit passes already in `docs/07-risks-and-gaps.md`
> and `docs/09-product-review.md`; feature proposals are marked as such, not asserted as current fact.
>
> **Revised 2026-08-22 (later same day):** the business model was clarified — Crewaa is an
> agency-model marketplace (brokers the deal, takes a 20-25% commission, non-exclusive to
> creators), not a neutral record-keeper. This flips two of the six original decisions (§1.2
> Crewaa's role, §1.3 payment approach — see decisions log). Still on hold for implementation.

---

## Where V1 left off

V1 is a working, hardened, end-to-end product: signup → profile → AI-scraped stats → AI matching
(brand↔creator, both directions) → real campaigns with real terms → "I'm interested" → brand sees
responses. Auth, rate limiting, observability (Sentry), 212 backend tests, CI, and an admin console
are all in place and verified.

**The loop stops the moment a brand and creator both want to work together.** Per `CLAUDE.md`:

> Marketplace loop stops at "interested" ... What does not [exist]: messaging, agreeing terms,
> contracts, delivery tracking or payment. Today the handoff is a brand emailing a creator.

That is the single biggest gap, and it's the difference between a matching demo and a marketplace
that can charge anyone money. Everything in this plan is organised around closing it, then around
what breaks once real usage starts.

---

## V2 goal, in one sentence

**Take a brand and creator from "interested" to "the deal happened and Crewaa knows it," without
either side leaving the product.**

---

## Phase 1 — Close the marketplace loop (the actual point of V2)

This is the phase that turns Crewaa from a matching tool into a marketplace. Nothing else in this
document matters if this doesn't ship.

### 1.1 In-app messaging
- A thread per (campaign, creator) interest — reuse the existing `opportunity_interests` /
  campaign relationship as the anchor so there's no new identity model to build.
- Text only for v1 of this feature; attachments (a creator's rate card, a brand's brief PDF) can
  follow.
- **Decided:** the brand's identity reveals **immediately** the moment a creator expresses
  interest — no further reveal step. This matches how V1's interest flow already works today
  (the brand already sees the creator on interest), so messaging can open as soon as an interest
  row exists — no new reveal-state machine needed.

### 1.2 Deal terms & agreement
- A lightweight "offer" object: fee, deliverables, deadline — brand proposes, creator
  accepts/counters/declines. This is different from the campaign's stated terms (which are the
  brand's general offer to anyone); this is the specific agreed terms with *this* creator.
- Status states: proposed → countered → accepted → (later) delivered → closed.
- No contract law here — this is a structured agreement record, not a legal document.
- **Decided (revised 2026-08-22):** Crewaa **is a party to the agreement**, not a record-keeper.
  Crewaa operates as an agency-model marketplace: it brokers the brand↔creator deal and takes a
  commission. This reverses the original V2 decision (see decisions log) — the earlier
  "record-keeper only" framing assumed no commission; that assumption no longer holds.
- **Commission: always 20% or 25% of deal value**, tier decided per-deal based on value.
  **Still unresolved as of 2026-08-22 (confirmed, not blocking messaging):** the exact value
  threshold that decides 20% vs 25%. Does not block Phase 1's messaging slice — only blocks the
  payment/escrow phase, since commission isn't calculated until a deal actually settles.
  Positioning: cheaper than a typical agency's ~30% cut, and **non-exclusive** — unlike a
  typical agency, Crewaa does not tie up a creator; they remain free to take other campaigns/deals
  outside the platform. Non-exclusivity is treated as a core differentiator, not just a fee gap.

### 1.3 Payment — the decision that shapes everything else in this phase
Three real options, each with a very different engineering and compliance footprint:

| Option | What it means | Effort | Risk |
|---|---|---|---|
| **A. No payment in-app** | Crewaa just records "deal closed," money changes hands outside the platform (bank transfer, UPI) as it does today | Low | Low — but caps Crewaa's ability to take a commission |
| **B. Payment tracking only** | Brand marks "paid," creator confirms "received" — no money actually moves through Crewaa | Low–Medium | Low, but easy to abuse (either side can lie) |
| **C. Real payments/escrow** ✅ **decided** | Crewaa integrates a payment gateway (Razorpay/Stripe), holds funds until delivery, takes a commission | High | High — PCI-adjacent compliance, refund/dispute handling, tax/invoicing |

**Decided (revised 2026-08-22): Option C for V2** — real payment/escrow, not tracking-only.
This follows directly from §1.2: if Crewaa takes a 20-25% commission, money has to actually move
through the platform to collect it — Option B (tracking only, "brand marks paid") gives Crewaa no
real way to take a cut, since nothing stops either side from settling outside the app and lying
about it. This is a bigger engineering/compliance lift than originally planned (payment gateway
integration — Razorpay/Stripe are the likely fits for INR — held funds, refund/dispute handling,
tax/invoicing) and should be scoped as its own implementation plan when Phase 1 is authorized to
start, not estimated at this document's level of detail.

**🔴 Hard blocker, confirmed open as of 2026-08-22: legal/compliance for holding funds is not yet
checked.** Holding customer money as a marketplace in India is not purely an engineering decision —
RBI's Payment Aggregator regulations generally mean self-custody of client funds needs either a PA
license or routing through a licensed provider's escrow/split-payment product (e.g. Razorpay Route,
Cashfree's marketplace settlements). **No payment/escrow code should be written until this is
confirmed with a CA or fintech-savvy lawyer.** This does not block messaging, offers, or delivery
tracking (§1.1, §1.2's non-financial parts, §1.4) — only the money-movement piece.

### 1.4 Delivery tracking
- Creator marks deliverables as submitted (a link — Instagram post URL, YouTube video URL).
- Brand confirms receipt/approval.
- This closes the loop record: campaign → interest → offer → delivery → closed.

### 1.5 Reviews / ratings (both directions)
- Brand rates the creator, creator rates the brand, after a deal closes.
- This is what makes the *next* match better — a track record is the thing that makes Crewaa more
  valuable than a cold DM, and it's currently completely absent.

---

## Phase 2 — Things that break once Phase 1 creates real usage

Phase 1 turns Crewaa into something people actually transact through. That exposes gaps that don't
matter in a demo but matter immediately in production:

### 2.1 Notifications
- Right now nothing tells a creator "a brand replied" or a brand "a creator accepted." With
  messaging and offers, silence is no longer acceptable.
- In-app notification bell (unread count, list) is the floor. Email notifications (a real
  transactional email provider — Postmark/Resend/SES) for anything time-sensitive (new message, offer
  received, offer expiring) should ship alongside, not after.

### 2.2 A real background job queue
Already flagged as open in `CLAUDE.md`:
> Background tasks are still in-process ... a real queue is still a v2 decision.

Scrapes and AI calls currently run via FastAPI `BackgroundTasks` in the same process — a deploy or
crash silently kills an in-flight job. With more usage this gets worse, not better. Recommend a
real queue (Celery+Redis, or a lighter option like `arq` since Redis is already a config'd-but-unused
dependency) once traffic justifies the operational cost of running a worker process. Not urgent at
V1's current traffic; becomes urgent the moment scrape/AI volume grows.

### 2.3 Refresh tokens
Also already flagged as open:
> `REFRESH_TOKEN_EXPIRE_DAYS` is read and never used ... there is no `/refresh` endpoint. When the
> access token expires the user is bounced to `/login` mid-task.

With messaging and offers in the product, being logged out mid-conversation is actively bad UX, not
just an inconvenience. Worth doing in Phase 2 rather than deferring further.

### 2.4 Infra: get off the free tiers
Directly caused this week's "everything is slow" investigation. Render free tier sleeps after 15
minutes idle (30–60s cold start); Neon free tier autosuspends. A keep-alive pinger was added as a
stopgap, but the honest fix — once there's a reason to believe in continuous usage (i.e. once Phase
1 ships and people actually use messaging) — is:
- Render Starter, ~$7/mo — kills the cold start entirely.
- Neon stays on Launch (usage-based, no fixed floor) once free-tier limits (0.5GB storage, 100
  compute-hours/mo) start being hit.

### 2.5 Neon password rotation
Still open from V1 (`ACTION-REQUIRED.md` §1). Not a V2 feature, but should not be deferred once
this document is being planned around "V2" — a leaked, unrotated production credential is a bigger
risk the more the platform is worth. **Recommend doing this before Phase 1 starts, not after.**

---

## Phase 3 — Trust, safety, and verification

Once money and reputations are genuinely on the line (Phase 1 ships), the trust surface needs to
grow with it:

- **Decided: manual verification for V2.** An admin reviews and approves via the existing admin
  console rather than building OAuth-based automated proof of platform ownership. Cheap to build,
  doesn't scale — revisit automation once verification volume makes manual review a bottleneck.
- **Creator verification** — a manual check that a linked Instagram/YouTube handle actually
  belongs to the person signing up (today anyone can type any handle).
- **Brand verification** — similarly, some signal that a "brand" account is a real business, not
  a scraper account created to see creator contact info.
- **Dispute handling** — what happens when a brand says "not delivered" and a creator says "it was"?
  At minimum: an admin-mediated flag on the deal record. Full dispute resolution is out of scope for
  V2; the flag + admin visibility is the floor.
- **Report/block** — for the messaging feature once it exists, a report button is not optional.

---

## Phase 4 — Growth & monetization

Only worth planning in detail once Phase 1 is live and there's real usage to learn from, but worth
naming now so infra decisions in Phase 1–2 don't foreclose them:

- **Commission model** — already decided as the core revenue model (§1.2/§1.3): 20-25% of deal
  value, collected via the real payment/escrow flow (Option C). The open item here is just the
  value threshold(s) that decide 20% vs 25% per deal.
- **Featured/boosted creator placements** — a monetization lever for the brand-discovery side that
  doesn't require payments infrastructure at all; could ship earlier than commission.
- **Subscription tiers for brands** — e.g. campaign count limits on a free tier, unlimited on paid.
  Independent of the payment question, so this could be a Phase 2 experiment.
- **Creator portfolio / media** — richer creator profiles (past work samples, media kit upload)
  make both discovery and deal-closing more informed. Needs file storage (S3/Cloudflare R2 —
  nothing in the current stack handles binary uploads yet).

---

## Explicitly out of scope for V2 (don't let scope creep in here)

- Native mobile apps — the responsive web app already tests clean at 390×844; no evidence yet that
  a native app is needed.
- Multi-platform expansion (TikTok, X, etc.) — Instagram + YouTube are the whole product today;
  adding platforms multiplies scraper maintenance for unproven demand.
- Light mode — flagged in `docs/09-product-review.md` as "half-implemented and visibly broken,"
  with the toggle removed but `ThemeProvider` left mounted. Either commit to building it properly
  or remove the remaining scaffolding — not a V2 priority either way.

---

## Decisions log (resolved 2026-08-22)

| # | Question | Decision |
|---|---|---|
| 1 | Anonymity in messaging (§1.1) | Reveal immediately on interest — no separate reveal step |
| 2a | Fee disclosure at acceptance (§1.2) | **Decided 2026-09-26: gross only.** No fee or net figure is shown to a creator when terms are agreed. Must be revisited before §1.3 ships, or creators will agree to a number they do not receive. |
| 2 | Payment approach (§1.3) | ~~Option B (tracking only)~~ **Revised 2026-08-22: Option C (real payments/escrow)** — required to actually collect commission |
| 3 | Crewaa's role in the agreement (§1.2) | ~~Record-keeper only~~ **Revised 2026-08-22: Crewaa is a party to the deal**, agency-model, commission 20-25% of value, non-exclusive |
| 4 | Verification approach (Phase 3) | Manual, via the existing admin console |
| 5 | Phase order | Confirmed as written: 1 (close the loop) → 2 (infra) → 3 (trust/safety) → 4 (monetization) |
| 6 | Team/resourcing | Solo build (Vishal + Claude), same as V1 — scope Phase 1 conservatively, one slice at a time |
| 7 | Escrow legal/compliance (§1.3) | **Open — confirmed 2026-08-22.** Must be checked with a CA/lawyer before any payment/escrow code is written. Does not block messaging. |
| 8 | Commission threshold (§1.2) | **Open.** 20% vs 25% cutoff not yet set. Did not block §1.2: on 2026-09-26 Vishal chose to record gross fees only and show no commission at all until payment. `commission_rate_pct` is reserved on `deal_offers` and stays null. Blocks §1.3. |

---

## Status: Phase 1 and Phase 3 complete. Phase 2 complete except the job queue. Phase 4 not started — all three deferred items moved to V3.

2026-08-22: Vishal authorized starting Phase 1, scoped to messaging only. **Messaging is now
built:**
- Backend: `app/modules/messaging/` (`Message` model anchored on `opportunity_interests.id`,
  4 endpoints — list threads, get thread, send, mark read, plus unread-count), migration
  `d4f8a2c1e9b7` applied to production Neon.
- The anonymity reveal (decision #1) is implemented exactly as scoped: only inside the new
  messaging router's counterpart resolution, not touching `ai/router.py` or the opportunity
  scrubbing logic.
- Frontend: `/dashboard/messages` (thread list) and `/dashboard/messages/[interestId]` (thread
  detail + compose), added to the navbar for both roles and to the shared-route allowlist in
  `lib/session.tsx`.
- Verified: 12 new backend tests (ownership, the anonymity reveal, send/receive, withdrawal
  blocking, unread counts) — full suite 224/224 passing. Frontend: 0 typecheck errors, 0 lint
  errors, clean production build (27 routes).
- **Not verified:** a real manual click-through in the browser — skipped by Vishal's choice since
  local dev points at production Neon and the automated coverage was judged sufficient. Worth
  keeping in mind if anything messaging-related looks off in practice.

### 2026-09-26 — deal terms (§1.2) built

Vishal authorized §1.2. It is built and verified:

- Backend: `app/modules/deals/offers.py` (`DealOffer`), `offer_router.py` (5 endpoints — read
  terms, propose/counter, accept, decline, withdraw), migration `e7b3d9c45a18`.
- **Offers are immutable.** Countering writes a new row pointing at the previous one via
  `supersedes_id` rather than editing it, so the negotiation history survives and `accepted`
  points at one specific row forever.
- **One agreed deal per interest is enforced by the database**, not just the handler — a partial
  unique index (`uq_deal_offers_one_accepted`). A read-then-write check loses a genuine race;
  two agreed prices on one deal would be unresolvable afterwards.
- Nobody can respond to their own offer, so an agreement the other side never saw cannot be
  manufactured.
- **Commission is deliberately absent** (Vishal's decision, 2026-09-26): Crewaa's 20-25% is not
  calculated until settlement, and the tier threshold is still open. `commission_rate_pct` exists
  on the offer and stays null; when payment lands, the rate must be **snapshotted at acceptance**
  so a later rate change cannot rewrite an agreed deal.
- Frontend: `components/dashboard/deal-terms-panel.tsx`, rendered inside the existing message
  thread — negotiating a fee *is* the conversation, so it does not get its own page.
- Verified: 21 new backend tests (full suite 245/245), 0 typecheck errors, 0 lint errors, and a
  four-phase browser walkthrough of a real negotiation: brand proposes ₹30,000 → creator counters
  ₹45,000 → brand accepts → both sides see the same fixed record with the ₹30,000 preserved in
  history. No JS errors, no 4xx/5xx.

**Open follow-up:** creators are not yet told that a platform fee applies. That is fine while no
money moves, but it must be resolved *before* payment ships — agreeing ₹45,000 and receiving
₹33,750 without warning is precisely the "numbers nobody agreed to" failure V1 spent a pass
eliminating.

### 2026-09-30 — delivery (§1.4) and reviews (§1.5) built

Vishal authorized both. The loop record is now complete end to end:
**campaign → interest → offer → delivery → review**, with only money outstanding.

**§1.4 delivery** — `app/modules/deals/deliveries.py`, migration `b2f6a8d13c47`.
- Anchored on the **accepted offer**, not the interest: you deliver against terms that were
  agreed, and the agreed offer is the only row saying what was owed.
- Roles are asymmetric — creator submits, brand approves or requests changes. Neither may do
  the other's job, or the record proves nothing.
- Submissions are **immutable**; resubmitting supersedes. "You never posted it" versus "I
  posted it on the 3rd" is settled by a timestamp nobody can edit.
- A submission's label is validated against the agreed deliverables, so "1x Reel (45s)" cannot
  be satisfied by something called anything at all.
- Requesting changes requires a reason — "rejected" with no explanation gives the creator
  nothing to act on.
- Completion is **derived from the submissions, never stored**. A `delivered` flag would be a
  second source of truth that drifts the first time a write fails halfway.

**§1.5 reviews** — `app/modules/deals/reviews.py`, migration `c8e1b47f2a93`.
- **Double-blind**: neither side sees the other's rating until both submit, or until
  `REVIEW_REVEAL_DAYS` (14) passes. Whoever goes second could otherwise read their rating and
  answer in kind, which teaches the first reviewer to under-report problems.
- The time window matters as much as the blindness: without it, simply never reviewing is a way
  to suppress a bad rating forever.
- Hidden reviews are excluded from public counts **and** averages — an average that shifts the
  moment somebody submits says exactly what they wrote.
- Gated on delivery being complete: a review written before any work happened rates a
  conversation, not a track record.
- One review per person per deal, enforced by a unique constraint rather than a handler check.

Verified: 24 new backend tests (full suite 269), 0 typecheck errors, 0 lint errors, and a
five-phase browser walkthrough — creator submits, brand approves, second deliverable, deal marks
Complete, both review. The brand's "Good work, slightly late" stayed hidden until the creator
submitted theirs, then both revealed. No JS errors, no 4xx/5xx.

**Still not authorized:** payment/escrow (§1.3).

Payment/escrow specifically stays blocked on the compliance check (decision #7) regardless of how
messaging went. Come back here before picking up the next slice.

---

### 2026-10-04 — Phase 2 (partial) and Phase 3 (complete)

Vishal authorised Phase 2, 3 and 4, then narrowed it after the costs were on the table:
**payment (§1.3), the job queue (§2.2) and the infra upgrade (§2.4) all move to V3**, and
Phase 4 is not started at all — his own plan said it was only worth detailed planning once
there is real usage, and there is not yet.

**Loose ends first (not in the original plan).** Light mode was "half-implemented and visibly
broken" per `docs/09-product-review.md`, with the toggle removed and `ThemeProvider` left
mounted. Removing the scaffolding — the obvious reading — would have made it *worse*:
`globals.css` defines the Tailwind variant as `&:is(.dark *)` and `:root` sets a white
`--background`, so `.dark` was only ever applied by `next-themes` following the OS preference.
Anyone on a light OS was already getting ~48 `dark:` utilities silently not applying inside a
hardcoded dark shell. Fixed by pinning `dark` on `<html>`; `next-themes` and two orphan toggle
components are gone.

**§1.3 payment — "coming soon" state.** Shown the moment terms are agreed, quoting the agreed
figure back and stating plainly that money is settled directly and Crewaa never holds it. The
open follow-up from 2026-09-26 still stands and is now recorded in the component itself: the
20-25% commission is disclosed nowhere, which is honest while no money moves and becomes a lie
the moment it does.

**§2.3 refresh tokens — built.** `/auth/refresh`, an httpOnly cookie, rotation on every use, and
`users.token_version` for revocation (migration `a4d81e37c6b2`). The axios interceptor refreshes
silently and is single-flight — without that, one expired token produces a burst of simultaneous
401s, and because the server rotates on use, all but one would redeem an already-superseded token
and log the user out at exactly the moment the feature exists to keep them in.

Two findings worth recording:

* `get_current_user` checked the setup token's `purpose` claim but never `type`. Every Crewaa
  token is signed with the same secret, so adding refresh tokens would have made a weeks-long
  cookie usable as a session credential, invisibly. Fixed first, and checked positively
  (`== "access"`) so the next token kind fails closed.
* Rotation was not rotating. The payload was determined by `(sub, ver, exp)` and `exp` has
  one-second resolution, so a refresh in the same second returned a **byte-identical** token —
  the old cookie kept working because it *was* the new one. Fixed with a `jti`.

**§2.1 in-app notifications — built.** `notifications` table (migration `b9e5f10a7c43`), four
endpoints, a navbar bell polling every 45s, and emits on all five events that previously told
nobody anything. A burst of messages on one thread collapses into a single unread entry rather
than twenty; the review notification deliberately says nothing about the rating, which would
otherwise walk straight through the double-blind in §1.5. Email notifications are **not** built —
still the open half of §2.1.

**Phase 3 — complete.** Migration `c7a3d84f1e09` adds everything in one additive pass.

* **Report & block.** Messaging between strangers shipped in August with neither. A block in
  *either* direction stops messages *both* ways: a one-way block is a mute button that still
  lets you shout. Nothing is hidden or deleted — the conversation is the evidence for any report
  about it. Report and block are separate actions, because bundling them means whoever cannot
  afford to end a deal never reports at all. The reported person is never notified.
* **Manual verification** (decision #4). Status lives on `users`, so one column and one queue
  cover both roles. It is a **signal, not a gate** — gating discovery on it would have silently
  delisted every existing creator on the day it shipped. A rejection requires a written reason,
  since the user can reapply.
* **Dispute flag.** One open dispute per deal, enforced by the partial unique index
  `uq_deal_disputes_one_open` rather than by the handler. It records a disagreement and changes
  nothing about the delivery or the agreed terms — a dispute that could edit those would let
  either party rewrite the evidence the argument is about. Resolving requires a written outcome
  that both parties can see.
* **Admin console** at `/dashboard/admin/trust`: three queues, **oldest first** — newest-first
  buries the item that has waited longest, which is the one most likely to concern someone still
  being harmed. Every resolution records which admin acted.

**One real bug caught by its own test.** `block` and `raise_dispute` both read `current_user.id`
*after* `await db.rollback()`. The rollback expires every object in the session, so that read
triggers a lazy reload outside the async context and raises `MissingGreenlet` — blocking someone
twice (a double submit, a second tab) would have been a 500 in production. Now CLAUDE.md rule 24.

Verified: 333 backend tests passing (up from 281), 28 migrations still linear, 0 frontend
typecheck errors, 0 lint errors. **Not verified: `pnpm build` and a browser walkthrough** — the
committed `node_modules` carries the darwin-arm64 SWC binary, so neither runs in a Linux sandbox.

### Moved to V3

| Item | Why |
|---|---|
| §1.3 payment / escrow | RBI Payment Aggregator compliance unchecked (decision #7); commission threshold still open (decision #8); fee disclosure must be resolved first |
| §2.2 real job queue | Render background workers have no free tier — $7/mo floor. Deferred until transaction volume justifies it |
| §2.4 off the free tiers | Same call; the stuck-job sweeper and keep-alive pinger remain the stopgaps |
| Phase 4 (all) | Monetization is not worth detailed planning before there is usage to learn from — as this document already said |
| Email notifications | The in-app bell covers the floor; email needs a provider account and DNS verification |
