# Crewaa — Version 3 Plan

> Started 2026-10-06. Status: **approved 2026-10-06. All phases (0–5) built on branch `v3/phase-0`, not yet committed.**
> Where the build differs from the plan below, an *As built* note says so; the build log at the end is the record.
> Rule for this version: decide first, then build. Nothing below marked *open* gets built until Vishal answers it.

---

## V3 goal, in one sentence

Turn Crewaa from a single creator–brand marketplace into a premium, four-part platform for the
creator economy, with a new visual identity, trustworthy creator data (including fake-engagement
detection), and a sharper AI engine.

---

## V3 scope and build phases *(approved 2026-10-06)*

Each phase ships on its own and leaves the live site working. Order matters: later phases build on earlier ones.

### Phase 0 — Foundations
- Royal Peacock design tokens in `globals.css`; replace ~600 hard-coded colours across every screen.
- Fonts: Bodoni Moda (headlines) + Instrument Sans (text), as in the approved mock.
- Recoloured logo, favicons, OG image and LinkedIn banner (`brand/` + `frontend/public`).
- New app navigation by role, with the five parts:
  brands → Collabs, Grow, AI Influencers, AI Marketing Suite; creators → Collabs, AI Marketing Suite, Crewaa Crew.
  Existing pages move under Collabs (discover, campaigns, deals, messages) and the Suite (growth analyzer, analytics).
  *As built:* every existing page, including the growth analyzer and analytics, stays under Collabs until the Suite launches.
- `api.crewaa.in`: serve the API from a Render custom domain (free on the Hobby plan; a DNS record).
  Makes the refresh cookie first-party, which stops Safari/iPhone users being signed out.

### Phase 1 — Trustworthy data
- Fix the four scraping bugs: AI reading old snapshots, pinned posts, YouTube fuzzy channel search, `resultsLimit`.
- Scheduled re-scrapes so data stays fresh, without paid infra: a GitHub Actions scheduled workflow (free) calls a
  protected admin endpoint that queues refreshes in-process, staggered and rate-limited.
- A clear "data as of" date on every number, and a "refresh" prompt when data is old.
- **Authenticity Score** (0–100 with reasons) for Instagram and YouTube: engagement vs. size benchmark,
  likes:comments ratio, views:followers, follower-growth spikes, AI check of comment quality.
  *As built:* comment quality is checked by code, not AI, so third parties' comments are never sent to Google.
- Shown on creator cards, discovery results and the creator's own analytics.

### Phase 2 — Smarter AI engine
- All numbers computed in code; Gemini only reasons and writes.
- Structured output (response schema) instead of parsing JSON from text.
- Embedding pre-match (pgvector on Neon) before AI ranking; authenticity feeds into ranking.
  *As built:* vectors are stored as JSON in `semantic_embeddings`, not pgvector — enough at this scale.
- Eval suite run live before/after every prompt change.

### Phase 3 — Landing page and part pages
- Build the approved landing page in Next.js (framer-motion), mobile and reduced-motion included.
  Grow, AI Influencers and the Marketing Suite carry a "Coming soon" badge on it.
- **Crewaa Grow** — "coming soon" page (decision 14).
- **AI Marketing Suite** — "coming soon" page (decision 15).
- **AI Influencers** — page + waitlist sign-up; waitlist visible in the admin console (decision 12).
- **Crewaa Crew** — "coming soon" page (decision 18).
- Full pages for **Collabs** and **Crewaa Crew**; refreshed sign-up with brand / creator choice.
- Existing creator tools (growth analyzer, IG/YT analytics) stay live under Collabs until the Suite launches.

### Phase 4 — Email notifications
- Transactional email provider: Resend free plan (3,000 emails/month, 100/day), `crewaa.in` verified by DNS (SPF/DKIM).
- Emails for the events the in-app bell already covers (new interest, offer, message, delivery, review),
  plus Crew request updates and waitlist confirmation.
- Royal Peacock email template; per-user unsubscribe/preferences.

### Phase 5 — Crewaa Crew: coming-soon page only *(changed 2026-10-06, decision 18)*
- Public `/crew` and in-app Crew pages say "Coming soon" and nothing more, like Grow and the Suite.
- The fuller plan below is kept for when Crew is built in a later version:
- Service catalogue: video editing, script writing, thumbnails (list to confirm).
- Creator raises a request with a brief and files → Crewaa team assigns it to in-house staff or a vetted freelancer.
- Status tracking (requested → in progress → delivered → revision) with delivered files, in-app + email notifications.
- Admin console: request queue, assignment, freelancer list.
- Payment handled outside the platform for now (payments still blocked, see below).

### Out of V3 (later versions)
- **AI Influencers as a working tool** — V3 ships page + waitlist only.
- **Crewaa Grow service** — V3 ships a coming-soon page only.
- **AI Marketing Suite tools** — V3 ships a coming-soon page only.
- **Crewaa Crew service** — V3 ships a coming-soon page only (decision 18).
- **Payments / escrow** — still blocked on RBI compliance (carried over from V2).
- **Light mode** — Crewaa stays dark-only.
- **Paid infrastructure** — parked like payments (decision 17). Costed options, checked against Render's pricing on 2026-10-06:

  | Option | What | Monthly |
  |---|---|---|
  | A (recommended when revisited) | Backend on Render Starter running the arq worker in-process + Upstash free Redis (persistent) | $7 |
  | B | Backend stays free + separate Starter background worker + free Redis | $7 |
  | C | Starter backend + Starter worker + free Redis | $14 |

  Render has no free background workers; free web services sleep after 15 min idle (≈1 min wake-up);
  Render's free Key Value does not persist to disk. Until then: deploys can still kill an in-flight scrape
  (stuck-job sweeper cleans up), and the keep-alive pinger stays.

---

## Decisions log

| # | Date | Decision |
|---|---|---|
| 1 | 2026-10-06 | **Colour theme: Royal Peacock** (chosen from 12 candidates). Stays dark-only, so no light mode is built in V3. |
| 2 | 2026-10-06 | Part 2 is named **Crewaa Grow**. |
| 3 | 2026-10-06 | **Creator side sees: Collabs, Creator Support, AI Marketing Suite.** Creators do not see Grow or AI Influencers. |
| 4 | 2026-10-06 | **Grow is a managed service**, not self-serve: the Crewaa team delivers it, and the platform is where businesses request, track and review the work. |
| 5 | 2026-10-06 | **Creator Support = services for creators**: video editors, script writers and similar help, offered through Crewaa. |
| 6 | 2026-10-06 | Creator Support is named **Crewaa Crew**. |
| 7 | 2026-10-06 | Crewaa Crew work is delivered by **both** Crewaa's in-house team and vetted freelancers. |
| 8 | 2026-10-06 | Crewaa Grow covers **everything a business needs to grow online** (Meta ads, lead generation, and more), not just ads and leads. |
| 9 | 2026-10-06 | **V3 scope for Grow: a proper Grow page only.** The full Grow service (accounts, intake, tracking, reports) is explored and built later. |
| 10 | 2026-10-06 | **Landing page design approved** (animated mock v2: logo-centred hero with orbiting crew, sticky five-part stage, authenticity scan, brand/creator switch, scroll timeline, gold Grow band). Royal Peacock is applied **everywhere**: landing, auth, every dashboard, emails and brand assets. |
| 12 | 2026-10-06 | **AI Influencers in V3: page + waitlist only.** The working tool is a later version. |
| 13 | 2026-10-06 | **Email notifications are in V3.** |
| 14 | 2026-10-06 | **Crewaa Grow in V3: a "coming soon" page only** (replaces decision 9's fuller page and the enquiry form). |
| 15 | 2026-10-06 | **AI Marketing Suite in V3: a "coming soon" page only.** The Suite's tools are a later version. |
| 16 | 2026-10-06 | Grow and Marketing Suite coming-soon pages are **just "coming soon"** — no notify-me or sign-up. |
| 17 | 2026-10-06 | **Paid infrastructure (job worker, Redis, Render Starter) parked for later**, like payments. V3 uses free options only. |
| 18 | 2026-10-06 | **Crewaa Crew in V3: a "coming soon" page only**, like Grow and the Suite — no request flow, no notify-me. The service is built later. |
| 11 | 2026-10-06 | **Logo recoloured** to the peacock colours: teal arc, peacock-blue crescent, gold dot. Shape and wordmark unchanged. |

---

## 1. Colour theme — Royal Peacock *(decided)*

Deep peacock-night background, peacock-teal primary, antique-gold secondary.

### Core tokens

| Role | Hex | Notes |
|---|---|---|
| Background | `#071A1F` | page ground |
| Surface | `#0D252B` | cards, panels |
| Surface raised | `#12303A` | popovers, hover, active tab |
| Border | `#1C3B43` | |
| Text | `#EAF4F3` | |
| Text muted | `#8FB0B0` | |
| Primary · peacock teal | `#26BDB0` | buttons, links, focus, key charts |
| On primary | `#03201C` | text on teal buttons |
| Secondary · antique gold | `#D8B45A` | premium highlights, badges, sparing use |
| Success | `#86D36B` | **adjusted** to a yellow-green so it does not blend with the teal primary |
| Warning | `#F29A4A` | **adjusted** to amber-orange so it does not read as the gold secondary |
| Danger | `#F2716B` | |

### Signature colour per part (tabs, icons and charts in that part only)

| Part | Colour |
|---|---|
| Collabs | teal `#26BDB0` |
| Grow *(name open)* | gold `#D8B45A` |
| AI Influencers | periwinkle `#8FA8FF` |
| Marketing Suite | coral `#EE8A6B` |
| Crewaa Crew (creator side only) | lilac `#B49CF0` |

### Implementation notes (from the code audit)

- Today's colours are not tokens: ~600 hard-coded Tailwind classes (`text-gray-400`, `bg-indigo-500`,
  `#0E1220`, …) across `app/` and `components/`. `globals.css` still holds the stock shadcn slate values.
- Step 1 is moving every colour into `globals.css` tokens; step 2 is swapping in the palette. After that,
  the whole platform stays in sync from one file.
- Keep CLAUDE.md rule 25 (dark-only, pinned `dark` class).
- Brand assets in `brand/` and `frontend/public` (logo, OG image, LinkedIn banner, favicons) need
  re-colouring too. Check timing against the trademark filing: file the **wordmark** so a colour change
  does not affect it.

---

## 2. Platform split into parts *(structure decided)*

| Part | Brand / business side | Creator side |
|---|---|---|
| **Collabs** — brand–creator collaboration (all existing marketplace features) | ✅ | ✅ |
| **Crewaa Grow** — business online-presence growth: Meta ads, AI lead finding | ✅ | — |
| **AI Influencers** | ✅ | — |
| **AI Marketing Suite** | ✅ | ✅ |
| **Crewaa Crew** — editors, script writers, etc. for creators (in-house + vetted freelancers) | — | ✅ |

### Crewaa Grow — managed service
**V3 builds a "coming soon" Grow page only** (decision 14). Everything below is for the later build.

The team does the work; the platform makes it visible and trackable. Likely platform pieces:
- business intake / onboarding brief (goals, budget, industry, location)
- service packages or plans
- request → in progress → delivered tracking
- performance reports (ad results, leads delivered) on the business's dashboard
- internal ops console for the Crewaa team (assign work, upload reports)

### Crewaa Crew — services for creators
**V3 builds a "coming soon" Crew page only** (decision 18). Video editing, script writing, and similar
(thumbnail design, captions, etc. — list to confirm) are for the later build.

### Open questions
- [ ] Grow (later build): packages and pricing; account type (current `BRAND` role or a new role).
- [ ] Crewaa Crew: paid per task or subscription? Full service list at launch.
- [ ] AI Marketing Suite: which tools for brands vs creators (captions, content calendar, post ideas, ad copy, …)?

### Lead times to start early
- Meta Marketing API needs **Business Verification + app review** (weeks).
- AI lead finding must comply with India's **DPDP Act 2023**.
- AI Influencers need clear AI-generated labelling (Meta's AI label; check current Indian rules on synthetic content).

---

## 3. Landing page *(after theme)*

Rebuild as the front door to all four parts: one Crewaa thesis, a section per part, proof and trust,
role-based CTAs (brand / business / creator). Mock in Royal Peacock and approve before coding.

---

## 4. Scraping fixes + fake engagement detection

### Bugs found in the 2026-10-06 audit (cause of "sometimes latest, sometimes old data")

1. **AI engine mixes old snapshots.** `ai/router.py` (payload builder, ~line 72) loads `InstagramPost`
   rows across *every* stored snapshot (90-day retention) and takes the 10 newest by `posted_at`, so the
   same post appears several times with older like/comment counts. The analytics route correctly filters
   `scraped_at == latest`. Fix: filter posts to the latest snapshot per user.
2. **Pinned posts treated as latest (to confirm).** Instagram shows up to 3 pinned posts first; they can be
   months old. Confirm the pinned flag in a real Apify `latestPosts` response, then exclude or flag them.
3. **YouTube resolves the channel by fuzzy search.** `youtube/scrapper.py` calls `search?q=<handle>&type=channel`,
   which can return a different channel and costs 100 quota units. Use `channels?forHandle=` (1 unit).
4. **`resultsLimit` may not apply** to `apify/instagram-profile-scraper` (it is an input of the general
   Instagram scraper). Verify, and consider a posts actor sorted by date for deeper history.
5. **In-process background tasks.** A deploy kills a running scrape (already deferred to V3). Scheduled
   re-scrapes for freshness need a real worker. *As built:* a free GitHub Actions schedule calls
   `/internal/refresh-stale` instead; a real worker stays parked (decision 17).

### Fake followers / likes / comments → Authenticity Score

Follower lists cannot be read from public data, so this is an **estimate**, as with HypeAuditor and similar tools. Signals:
- engagement rate vs benchmark for the follower tier
- likes : comments ratio
- reel views : followers
- follower growth spikes (snapshot history already stored)
- AI classification of comment quality (generic / emoji-only / bot-like) — requires scraping comments (extra Apify cost)

Output: a 0–100 score with reasons. Shown to brands as an estimate, never publicly labelled "fake" (legal risk).

---

## 5. AI engine upgrade

- Compute every number (engagement, averages, authenticity) in code; Gemini only reasons and writes.
- Use Gemini structured output (response schema) instead of extracting JSON from text.
- Embedding-based pre-matching before AI ranking (*as built:* JSON vectors, not pgvector).
- Feed authenticity signals into ranking.
- Run `python -m evals.runner --live --repeat 3` before and after every prompt change (rule 5).

---

## Other V3 suggestions (not yet agreed)

- Ship in phases: theme + navigation shell → scraping fixes + authenticity → landing page → Grow →
  Marketing Suite → AI Influencers.
- Grow is likely the first revenue part; consider launching it service-led.
- Infra: paid worker and hosting upgrade parked for later (decision 17); `api.crewaa.in` is in Phase 0 because it is free.
- Carry-overs from V2: payments/escrow (compliance) — still parked; email notifications — built in Phase 4.

---

## Build log

### 2026-10-06 — Phase 0 built
Royal Peacock tokens + palette remap (globals.css), Bodoni Moda / Instrument Sans, recoloured logo and
all brand PNGs/favicons, role-based five-part navigation (`lib/parts.ts`), coming-soon pages for Grow,
AI Influencers, Marketing Suite and Crew, `api.crewaa.in` steps in ACTION-REQUIRED §1d.
Verified: tsc 0 errors, lint 0 errors, `next build` passes, screenshots of brand/creator screens.

### 2026-10-06 — Phase 1 built
- **Old-data bugs fixed:** AI payload reads the latest snapshot only; pinned posts flagged
  (`is_pinned`) and excluded from analytics, AI and scoring; YouTube resolves channels exactly
  (`forHandle` / `id` / `forUsername`, search only as a last resort) with typed errors; the dead
  `resultsLimit` Apify input removed. Timestamps now display in the viewer's timezone (were 5½ h off).
- **Authenticity Score** (`app/modules/authenticity/`): six checks — engagement vs follower-tier
  benchmark, likes:comments, views:audience, growth spikes/drops, consistency, comment quality —
  weighted into 0–100 with reasons; unknown checks are left out rather than guessed. Comment quality
  is a deterministic heuristic (an AI pass can join in Phase 2); comment text is never stored.
  Shown to creators (full report on Analytics) and brands (badge on discovery, saved and interested
  creators; full report via `GET /authenticity/{id}`).
- **Freshness:** "Data as of …" bar with a refresh action and an over-a-week-old warning.
- **Scheduled re-scrapes:** `.github/workflows/refresh-creators.yml` every 6 h →
  `POST /internal/refresh-stale` (CRON_SECRET), stalest first, 5 per run, sequential.
- Migration `3f8b2d61a7c4` (additive). Tests 333 → 378, all passing; evals pass; tsc/lint/build pass.
- **Found, not fixed (pre-existing):** "View Complete Profile" on the brand dashboard links to
  `/dashboard/brand/creators/{id}`, which does not exist (404). Natural home: a brand-facing
  creator profile page showing the full Authenticity report — candidate for Phase 3.

### 2026-10-06 — Phase 2 built
- **Schema-validated output:** all four engines send a Pydantic `response_schema` and validate the
  reply (`llm_schemas.py`, `parse_structured`). Prompt text unchanged — schemas mirror what each
  prompt already asked for.
- **Numbers from code:** each platform in the payload carries a `computed` block (engagement vs the
  tier benchmark, reel/video reach, follower tier, data age) plus the creator's Authenticity
  concerns. Removed the invented `"pricing": "Mid"` that was sent for every creator.
- **Authenticity in ranking:** low score → never High fit (capped at Medium), reason shown first in
  risks; not-enough-data noted as a risk; High fits listed first. Saved fit reflects the cap.
- **Semantic pre-matching:** `gemini-embedding-001` (768-d, normalised), cached per creator /
  campaign with a content hash. Discovery pre-ranks a pool of up to 200 and sends the best 40;
  brand deals pre-rank campaigns for the creator when there are more than 12. Any failure falls
  back to the V2 order. JSON vectors instead of pgvector — deliberate at this scale.
- Caught by the new tests before shipping: the fallback path rolled back the request session and
  crashed discovery (CLAUDE.md rule 24) — fixed by writing the cache through its own session.
- Migration `9c1e5a3d7b20` (additive). Tests 378 → 397, all passing; offline evals pass.
- **Not done here — needs Vishal:** live evals before/after (ACTION-REQUIRED §0b). Skipped by
  design: an AI pass over comment quality (would send third parties' comments to Google; the
  deterministic check stays).

### 2026-10-06 — Phase 3 built
- **New public site** (`app/(landing-page)/`, `components/site/`), built from the approved mock:
  animated hero with the Crewaa mark and orbiting creator/brand chips, scroll-driven tour of the
  five parts, Authenticity Score section, brands/creators switch, four-step timeline, Grow band,
  final call to action. Respects reduced motion; no horizontal scroll at 390px.
- **Part pages:** `/collabs` (live), `/grow` and `/marketing-suite` (coming soon, nothing else),
  `/ai-influencers` (coming soon + waitlist), `/crew` (coming soon). Contact, privacy and terms sit
  under the new nav. The old `components/landing-page/` is deleted.
- **AI Influencers waitlist:** `POST /waitlist` (public, 5/hour per IP, idempotent, same answer for
  new and known emails, linked to an account when the email matches) and `GET /admin/waitlist`;
  form on the public page and in the app (email prefilled); Admin → Waitlist with CSV export.
  Migration `4b7d2e9f1c56` (additive).
- **Fixed a dead link:** "View complete profile" on the brand dashboard pointed at a page that never
  existed. Now `/dashboard/brand/creators/[id]` (`GET /ai/creators/{id}`, brands and admins only, no
  contact details) with stats and the full Authenticity report.
- Sign-up role picker redone in the theme and shows which parts each side gets; site-wide
  title/description updated to the V3 positioning.
- Tests 397 → 403, all passing; typecheck, lint (no errors) and production build pass.

### 2026-10-06 — Phase 4 built
- **Email notifications** for everything the bell shows — new messages, offers and counter-offers,
  accepted/declined terms, deliveries and change requests, reviews — plus two new events: **a
  creator expressing interest** now notifies the brand (in-app and email; it previously notified
  nobody), and joining the AI Influencers waitlist sends a one-time confirmation. Crewaa Crew
  emails are wired (`crew` kind and setting) for Phase 5.
- **Reliable by design, no paid infrastructure:** the email is written to an outbox in the same
  transaction as the event, sent seconds later by a background task, and retried by the existing
  6-hourly GitHub workflow. Idempotency keys and row claiming prevent duplicates; failures retry 3
  times; Resend rate limits pause the run; the daily limit (95) defers the rest to the next day;
  emails older than 3 days are dropped.
- **No spam:** at most one email per conversation per 30 minutes; settings checked at send time.
- **Royal Peacock email template** (dark, logo, teal button, gold accent), plain-text version,
  everything escaped. Footer: why you got it, Email settings, Unsubscribe.
- **Settings → Email notifications** (avatar menu and bell) with a switch per category; the Crew
  switch shows for creators only. **One-click unsubscribe** (RFC 8058 header for Gmail/Yahoo) and a
  themed /unsubscribe page that asks for a click, so link scanners can't unsubscribe anyone.
- Migration `6d1a8c3e5f92` (additive). Tests 403 → 429, all passing; typecheck, lint and build pass.
- **Needs Vishal:** Resend account, DNS records for crewaa.in, three env vars on Render
  (ACTION-REQUIRED §0d). Until then email is simply off.

### 2026-10-06 — Phase 5 done (scope changed to coming soon)
- Crewaa Crew is **coming soon only** (decision 18). Public `/crew` now matches Grow and the Suite:
  title, one line, the services it will cover, no sign-up button. The in-app Crew page no longer
  promises task tracking; the home page's Crew illustration is labelled "Example".
- The Crew email switch is hidden in Settings until Crew launches (the backend category stays,
  so nothing needs rebuilding then).
- Home hero line changed from "Now with Crewaa Grow, AI Influencers and Crewaa Crew" to
  "Coming soon: …" — none of the three has launched, so "now with" overstated it.
- **Version 3 is complete.** Every phase is built; what remains is the setup in ACTION-REQUIRED.md
  (migrations, Render/GitHub secrets, Resend and DNS, live evals) and committing the work.

### 2026-10-06 — Pre-commit sync audit
- **API:** all 85 frontend calls matched to backend routes. Response types for every V3 endpoint match
  the frontend types. One unused endpoint (`GET /deals/reviews/user/{id}`) is now shown on the creator
  profile page as "Reviews from brands".
- **Links:** every internal link, plus every link in notifications and emails, opens a real page. The
  creator profile is now linked from Discover and Responses as well as the Dashboard.
- **Theme:** the last white buttons (error, 404, campaigns, deals, growth analyzer, Responses) are now teal.
  The app manifest name and description match the V3 wording. The creator parts list on the sign-up page
  is in the same order as the nav.
- **Time zones:** ten more places now read API timestamps as UTC (`parseApiDate`). These include messages,
  the bell, admin and "generated on" dates.
- **Cleanup:**
  - Deleted three unused components (`flip-words`, `darkcard`, `right-sidebar`).
  - Fixed 13 lint warnings. The two left are intentional `<img>` tags for Instagram and YouTube avatars.
  - Admin Trust tabs wrap on phones.
- **SEO:** added `sitemap.xml` and `robots.txt` (dashboards excluded).
- **Docs:** brought the following in line with the code:
  - in CLAUDE.md, the data model (21 owned tables), env vars and known gaps
  - `docs/04-api.md` and `docs/06-frontend.md`, with a V3 section each
  - ACTION-REQUIRED, with a one-pass V3 checklist
  - this plan, with *As built* notes
- **CI:** the secret scan now also catches Resend keys.
- **Verified on a fresh copy:**
  - backend import check, offline evals and 429 tests all pass
  - migrations build all 25 tables from scratch; the four V3 migrations downgrade and re-apply
  - tsc and lint report no errors, and the production build passes
  - every page loads for every role at desktop and phone width, with no runtime errors and no
    sideways scroll

