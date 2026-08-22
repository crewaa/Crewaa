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
| 2 | Payment approach (§1.3) | ~~Option B (tracking only)~~ **Revised 2026-08-22: Option C (real payments/escrow)** — required to actually collect commission |
| 3 | Crewaa's role in the agreement (§1.2) | ~~Record-keeper only~~ **Revised 2026-08-22: Crewaa is a party to the deal**, agency-model, commission 20-25% of value, non-exclusive |
| 4 | Verification approach (Phase 3) | Manual, via the existing admin console |
| 5 | Phase order | Confirmed as written: 1 (close the loop) → 2 (infra) → 3 (trust/safety) → 4 (monetization) |
| 6 | Team/resourcing | Solo build (Vishal + Claude), same as V1 — scope Phase 1 conservatively, one slice at a time |
| 7 | Escrow legal/compliance (§1.3) | **Open — confirmed 2026-08-22.** Must be checked with a CA/lawyer before any payment/escrow code is written. Does not block messaging. |
| 8 | Commission threshold (§1.2) | **Open — confirmed 2026-08-22.** 20% vs 25% cutoff not yet set. Does not block messaging. |

---

## Status: messaging (§1.1) built and verified. Nothing else in Phase 1 is authorized yet.

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

**Still not authorized:** offers/delivery-tracking/reviews (rest of Phase 1) and payment/escrow.
Payment/escrow specifically stays blocked on the compliance check (decision #7) regardless of how
messaging went. Come back here before picking up the next slice.
