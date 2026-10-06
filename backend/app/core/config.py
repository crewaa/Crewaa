from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")
    
    app_name: str
    env: str
    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    refresh_token_expire_days: int

    google_client_id: str
    
    # Apify Instagram Scraping (direct SDK)
    apify_token: str = ""
    
    # Redis cache
    redis_url: str = "redis://localhost:6379/0"
    
    # YouTube API
    youtube_api_key: str = ""

    # Gemini AI Engine
    gemini_api_key: str = ""
    #: Model id. Kept in config so it can be changed without a code deploy —
    #: model changes are high-risk and may need to be rolled back quickly.
    gemini_model: str = "gemini-2.5-flash"
    #: Hard timeout for a single Gemini call, in seconds. Without this a hung
    #: request holds a worker until the client gives up.
    gemini_timeout_seconds: int = 60
    #: Max creators serialised into one discovery prompt. Beyond this the prompt
    #: approaches the context limit and quality degrades.
    ai_max_creators_per_prompt: int = 40
    #: Max brands fanned out over in one brand-deals run.
    ai_max_brands_per_run: int = 12
    #: How many Gemini calls may be in flight at once during that fan-out.
    ai_max_concurrent_calls: int = 4
    #: After this many days a cached AI result is shown as stale so the creator
    #: knows it predates their current numbers. `*_generated_at` was previously
    #: written and never read, so a cache could be months old with no signal.
    ai_cache_stale_after_days: int = 14

    #: bcrypt cost factor. Each step doubles the work: 12 is ~180ms on a laptop
    #: and noticeably more on a small shared instance. Lower it to 11 or 10 if
    #: sign-in feels slow in production — existing passwords keep working,
    #: because bcrypt records the cost inside each hash. Do not go below 10.
    bcrypt_rounds: int = 12

    #: Failed sign-in attempts allowed for one email+IP pair before a temporary
    #: lockout. Counted on failures only: a correct password is never refused
    #: for being "too many requests", which the previous IP-wide throttle did.
    login_max_failures: int = 8
    #: How long that lockout lasts, in seconds.
    login_failure_window_seconds: int = 900

    #: A scrape still marked "running" after this long is treated as dead.
    #: Scrapes are in-process background tasks, so a deploy or crash strands them
    #: as "running" forever and the creator watches a spinner that will never
    #: resolve. Age-based rather than "everything running at startup", which
    #: would be wrong the moment a second instance exists. Must comfortably
    #: exceed the slowest legitimate scrape (Apify runs take well under a minute).
    scrape_stuck_after_minutes: int = 15

    #: How long Instagram snapshots are kept. Each scrape appends a profile row
    #: plus up to 15 posts, forever — this bounds that growth. 0 disables pruning.
    scrape_ttl_days: int = 90

    #: Scheduled re-scrapes (V3 Phase 1). A GitHub Actions schedule calls
    #: POST /internal/refresh-stale with this secret in `X-Cron-Secret`.
    #: Blank disables the endpoint entirely (it answers 404).
    cron_secret: str = ""
    #: A creator's data is refreshed once it is older than this.
    refresh_after_days: int = 7
    #: Most creator-platform imports one scheduled run may start. Bounds Apify
    #: spend and keeps a run well inside one request's worth of work.
    refresh_batch_size: int = 5

    #: Semantic pre-matching (V3 Phase 2). Text model with task types;
    #: vectors are normalised in GeminiClient.embed.
    gemini_embedding_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 768
    #: How many candidates semantic pre-matching considers before the best
    #: AI_MAX_CREATORS_PER_PROMPT go to the model. Bounds embedding work.
    ai_candidate_pool: int = 200

    #: Email notifications (V3 Phase 4), sent through Resend.
    #: Blank key = email off: nothing is sent and queued emails are marked
    #: skipped, so local development and CI need no account.
    resend_api_key: str = ""
    #: Sender. The domain must be verified in Resend (SPF/DKIM) first.
    email_from: str = "Crewaa <notifications@crewaa.in>"
    #: Replies to a notification email land here rather than bouncing.
    email_reply_to: str = "support@crewaa.in"
    #: Where links in emails point. No trailing slash.
    frontend_url: str = "https://crewaa.in"
    #: Public URL of this API, for the one-click unsubscribe header
    #: (RFC 8058). Blank leaves that header out; the footer link still works.
    public_api_url: str = ""
    #: Most emails sent per UTC day. Resend's free plan allows 100/day; the
    #: rest wait in the outbox for the next day rather than being refused.
    email_daily_limit: int = 95
    #: At most one email per conversation per this many minutes. A burst of
    #: messages is one email, not twenty.
    email_message_cooldown_minutes: int = 30

    #: Sentry DSN. Blank disables error tracking entirely — the app runs
    #: identically without it, so local development and CI need no account.
    sentry_dsn: str = ""
    #: Defaults to `env` so issues are separated into dev/staging/production
    #: without a second setting to remember.
    sentry_environment: str = ""
    #: Optional version marker (a git sha works) so an issue can be tied to a
    #: deploy. Blank means Sentry groups everything under one release.
    sentry_release: str = ""
    #: Performance tracing is billed separately from errors. Off by default so
    #: turning it on is a decision, not a surprise.
    sentry_traces_sample_rate: float = 0.0

    # CORS — comma-separated list of allowed origins.
    # Overridable per environment so adding a domain is not a code change.
    cors_origins: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "https://crewaa-m4pz.vercel.app,"
        "https://crewaa.in,"
        "https://www.crewaa.in"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ------------------------------------------------------------------
    # Refresh-token cookie.
    #
    # In production the frontend (crewaa.in, Vercel) and the API (Render) are
    # on different registrable domains, so the refresh cookie is a *cross-site*
    # cookie. Browsers only send those with `SameSite=None`, and only accept
    # `SameSite=None` when `Secure` is also set — hence both, together.
    #
    # Locally everything is on localhost, which is same-site, and `Secure`
    # would stop the cookie being set over plain http. So the two flags move
    # together with the environment rather than being hardcoded either way.
    # ------------------------------------------------------------------

    @property
    def is_local(self) -> bool:
        return self.env.lower() in ("dev", "local", "test")

    @property
    def cookie_secure(self) -> bool:
        return not self.is_local

    @property
    def cookie_samesite(self) -> str:
        return "lax" if self.is_local else "none"


settings = Settings()
