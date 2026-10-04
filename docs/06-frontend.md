# Crewaa — Frontend

> Source: `frontend/` at commit `5e58465`. Next.js 16.1.1 App Router, React 19.2.3, TypeScript, Tailwind v4.

---

## 1. Route groups

```
app/
  layout.tsx                    root: fonts + GoogleOAuthProvider (wraps EVERYTHING, incl. landing)

  (landing-page)/               public marketing site
    page.tsx                    hero, what-is-crewaa, features, how-it-works, value-cards, footer
    contact/  privacy/  terms/

  (auth)/                       unauthenticated
    login/                      email+password + Google button
    signup/                     role picker → brand | influencer
    signup/brand/  signup/influencer/
    set-password/               lands here from Google sign-in with ?token=&email=

  (app)/                        authenticated
    layout.tsx                  ← the only real client-side auth gate
    dashboard/
      page.tsx                  placeholder, literally renders "Landing Page"
      profile/                  creator profile form
      brand-profile/            brand profile form
      influencer/               Creator Studio  → deals/, growth-analyzer/
      brand/                    Brand Studio    → discover/
      admin/                    stats → users/ → users/[id]/
      analytics/                page.tsx (generic) + influencer/ + brand/
```

**[V] `dashboard/analytics/page.tsx` and `dashboard/analytics/influencer/page.tsx` are near-identical duplicates** — same component, same tabs, differing only in a `loading` state and padding. One should go.

**[V] `dashboard/page.tsx` renders the string "Landing Page"** — dead placeholder that authenticated users can technically reach before the layout redirect fires.

---

## 2. Authentication in the browser

**Token storage [V]:** `localStorage.setItem("access_token", ...)` after login / set-password. Attached by an axios **request interceptor** in `lib/axios.ts`.

**[V] Interceptor ordering bug:** in `lib/axios.ts` the **response** interceptor is registered *before* the **request** interceptor. Both still run, so it works — but it reads as a mistake and will confuse the next person.

**[V] The axios response interceptor destroys the HTTP status:**
```ts
throw new Error(error.response.data.detail || "API Error")
```
Every failure becomes a generic `Error`. Pages that try `err?.response?.data?.detail` (deals, growth-analyzer) are reading a property that **no longer exists** by the time they see it — they fall through to `err.message`, which happens to hold the detail string. So it works by accident, and a 429 is indistinguishable from a 500 in the UI.

**Route protection [V]:** `(app)/layout.tsx` calls `getCurrentUser()` in a `useEffect`, then role-redirects:
- ADMIN → `/dashboard/admin`
- BRAND → `/dashboard/brand`
- INFLUENCER → `/dashboard/influencer`
- any error → `/login`

It returns `null` until the user loads, so there is a blank flash on every navigation.

**[V] The redirect uses `location.pathname` inside a `useEffect` with `[router]` as the dependency array.** It does not re-run on client-side navigation, and reading `location` directly rather than `usePathname()` sidesteps Next's router. The `admin/layout.tsx` adds a second, independent `getCurrentUser()` check — so loading an admin page makes two `/users/me` calls.

**[V] None of this is a security boundary.** It is UX only. Anyone can bypass it, which matters given the unauthenticated backend endpoints listed in `docs/04-api.md`.

**[V] `GoogleAuthButton` on the login page is rendered without a `role` prop**, so `role` is `undefined`. For a brand-new user, `/auth/google` then returns `400 "Role is required for first-time signup"`, surfaced as a browser `alert()`. Signing up via Google from the *login* page therefore fails by design — the user must go through `/signup/brand` or `/signup/influencer`. Worth confirming this is intentional.

**[V] `GoogleAuthButton` bypasses the shared axios client** and calls `axios.post` directly against `NEXT_PUBLIC_API_URL`, so it does not get the interceptors. Error handling there is `alert()`.

---

## 3. API client layer — `lib/`

| File | Contents |
|---|---|
| `axios.ts` | the shared `api` instance, `baseURL` = `NEXT_PUBLIC_API_URL`, `withCredentials: true` (no cookies are ever used), the two interceptors |
| `auth.ts` | signup, login, logout, setPassword |
| `user.ts` | getCurrentUser, getSavedCreators |
| `brand.ts` | create/get/update brand profile |
| `ai.ts` | discoverCreators, brand-deals (GET+POST), creator-summary (GET+POST) |
| `admin.ts` | stats, users list/detail/create/delete — **the only file with real TypeScript interfaces** |
| `utils.ts`, `motion.ts` | `cn()` helper, framer-motion variants |

**[V] Typing is inconsistent.** `lib/admin.ts` defines proper interfaces; `lib/ai.ts`, `lib/user.ts` and `lib/brand.ts` return bare `res.data` typed as `any`, and response types are re-declared locally in each page component. `user` state is `useState<any>(null)` in every dashboard.

**[V] Several pages bypass `lib/` and call `api.get`/`api.post` inline** (`dashboard/profile`, `dashboard/brand-profile`, `analytics/brand`, `instagram-analytics`, `youtube-analytics`, `creator-profile-form`). There is no single place that knows the API surface.

**[V] Import paths are inconsistent** — a mix of `@/lib/...` and deep relative paths like `../../../../../lib/user` (in `analytics/brand/page.tsx`).

---

## 4. 🔴 The user-id bug in the profile page

`app/(app)/dashboard/profile/page.tsx`:
```ts
await api.post(`/instagram/scrape/${savedProfile.id}`)
await api.post(`/youtube/scrape/${savedProfile.id}`)
```

`savedProfile` is a **`CreatorProfileResponse`**, so `.id` is `creator_profiles.id` — **not** `user_id`. The backend route is `/instagram/scrape/{user_id}` and looks up `CreatorProfile.user_id == user_id`.

These only coincide when a user's profile row id happens to equal their user id, which is true for early sequential test data and false in general. Compare:
- `components/dashboard/instagram-analytics.tsx` — uses `userId` correctly
- `components/dashboard/creator-profile-form.tsx` — uses `userId` correctly
- `analytics/*/page.tsx` — pass `user.id` correctly

So this one call site is wrong. In production it means: a creator saves their profile, the frontend fires a scrape for **the wrong user id**, and the scrape either no-ops or scrapes someone else's handle into someone else's rows.

**Mitigating factor [V]:** `POST /users/creator-profile` and `PUT /users/creator-profile` already queue a scrape server-side via `BackgroundTasks` using the correct `current_user.id`. So the correct scrape does happen anyway, and the frontend call is a redundant, wrongly-targeted extra. The fix is to **delete the two frontend calls**, not to correct the id — the server already handles it. Note the server-side auto-scrape covers Instagram only, so YouTube would need a matching background task added.

---

## 5. Components

**`components/dashboard/`** — `instagram-analytics.tsx` and `youtube-analytics.tsx` are the substantial ones: fetch analytics, show a scrape button, and **poll** `/analytics/{userId}` after triggering a scrape. `navbar.tsx` routes the logo and "Dashboard" link by role. `right-sidebar.tsx` exists but is **commented out** in `(app)/layout.tsx`. `chartwrapper`, `linechartcomponent`, `statcard`, `darkcard`, `recentposts`, `profileheader`, `sidebar-card` are presentational.

**`components/landing-page/`** — hero, features, how-it-works, value-cards, what-is-crewaa, footer, navbar, plus `gradient-background`, `section-glow`, `shimmer-field` (the visual polish from the most recent commit) and a `landing-page.css`.

**`components/ui/`** — shadcn/ui primitives over Radix: avatar, badge, button, card, dropdown-menu, input, label, separator, tabs, textarea, plus a custom `flip-words`.

---

## 6. Styling & theming

Tailwind v4 via `@tailwindcss/postcss`, `app/globals.css` holds the design tokens, `next-themes` provides dark mode through `components/theme-provider.tsx`.

**[V] Theme inconsistency:** the studio and AI pages hard-code a dark palette (`bg-[#06070C]`, `text-white`, blurred colour orbs), while the analytics pages use theme-aware Tailwind classes (`dark:` variants). In light mode the app is visually split down the middle. `ThemeProvider` is also mounted **inside** `(app)/layout.tsx` rather than at the root, so the landing and auth pages are outside it.

---

## 7. Known frontend defects

| Location | Issue |
|---|---|
| `dashboard/profile/page.tsx` | wrong id passed to scrape endpoints (§4) |
| `(auth)/login/page.tsx` | typo prop `blindnessClassName` on the password `<Label>`; the intended `className` is missing |
| `(auth)/login/page.tsx` | inputs have no `name` attribute — read via `elements.namedItem("email")`, which resolves by `id`; works, but fragile |
| `(auth)/login/page.tsx` | no error handling on `login()` — a failed login throws into an unhandled promise rejection and the form appears to do nothing |
| `lib/axios.ts` | response interceptor registered before request interceptor; HTTP status discarded |
| `(app)/layout.tsx` | `location.pathname` in a `useEffect` that does not re-run on navigation |
| `dashboard/analytics/page.tsx` | duplicate of `analytics/influencer/page.tsx` |
| `dashboard/page.tsx` | placeholder text |
| `navbar.tsx` | commented-out debug block with a hard-coded `userId={2}` |
| everywhere | `useState<any>`, no error boundaries, no loading skeletons beyond spinners |

**[V] There are no frontend tests**, no Playwright/Cypress, and `pnpm lint` is the only quality gate.

---

## V2 Phase 2 & 3 surfaces (added 2026-10-04)

### Routes

| Route | What it is |
|---|---|
| `/dashboard/admin/trust` | Three admin queues — reports, disputes, verifications — on one page, each oldest-first |

The admin section is guarded by `app/(app)/dashboard/admin/layout.tsx` plus `isRouteAllowed()`,
which does a `startsWith` on `/dashboard/admin`, so the new sub-route is covered without change.
As always this is a **UX guard only** — the server is the real boundary.

### Components

| Component | Notes |
|---|---|
| `components/dashboard/notification-bell.tsx` | Polls `/notifications/unread-count` every 45s. **Polling, not websockets**: a socket needs a connection per tab held across a free tier that sleeps, to deliver something nobody expects within the second. Polling degrades to "slightly late" instead of "silently disconnected". |
| `components/dashboard/safety-menu.tsx` | Report / block / dispute, in the thread header beside the counterpart's name — where someone is standing when they decide they need it. Also exports `DisputeBanner`. |
| `components/dashboard/verification-card.tsx` | On both profile pages. Shows status and offers a request; a rejection shows the admin's reason. |
| `components/dashboard/payment-status.tsx` | The "coming soon" state shown once terms are agreed. Quotes the agreed figure back and says plainly that Crewaa never holds the money. |
| `components/auth/auth-brand.tsx` | The lockup above all five auth cards; links home. |

### Auth handling (changed)

`lib/axios.ts` now refreshes silently. On a 401 it calls `/auth/refresh` once and replays the
request. It is **single-flight** on purpose: a dashboard fires several requests at once, so an
expired token produces a burst of simultaneous 401s, and because the server rotates the refresh
token on every use, all but one would be redeemed against an already-superseded token — logging
the user out at exactly the moment the feature exists to keep them in. `_retried` on the request
config prevents an infinite loop.

`NO_REFRESH` skips the retry for `/auth/login`, `/auth/signup`, `/auth/google` and `/auth/refresh`,
where a 401 is the answer rather than a stale session.

### Theming (changed)

`next-themes` is **removed**. `<html>` carries a pinned `dark` class set in `app/layout.tsx`.
`globals.css` defines the Tailwind variant as `&:is(.dark *)` and `:root` sets a *white*
`--background`, so previously anyone whose OS was set to light got ~48 `dark:` utilities silently
not applying inside a hardcoded dark shell. The `app-dark` runtime class dance in `DashboardShell`
is gone with it; `html { color-scheme: dark }` covers native scrollbars and the overscroll gutter.
