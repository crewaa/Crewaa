"""
Typed scraping failures, so a problem on our side is never reported as a
problem with the creator's account.

This exists because of a real incident (2026-09-30). `apify-client` is a
dependency that was never pinned; version 3 changed `actor.call()` from
returning a `dict` to returning a `Run` model, a Render redeploy picked up the
new major, and `run["defaultDatasetId"]` started raising
`'Run' object is not subscriptable`.

Every exception was caught by one handler and shown to the user as:

    "Could not fetch @name. The account may be private, renamed, or Instagram
     may be rate-limiting us."

So a bug in our own parsing was reported as Instagram's fault, on a scrape that
Apify had in fact completed successfully and charged for. The message actively
pointed the investigation away from the cause.

The distinction these three types draw is the one that matters to whoever is
reading the failure:

* `ScrapeConfigurationError` — Crewaa is misconfigured or broken. The creator
  can do nothing about it, and should not be told to check their account.
* `ProfileNotFoundError` — the account genuinely could not be read. This one
  *is* the creator's to act on.
* `ScrapeUpstreamError` — the provider failed or answered in a shape we do not
  understand. Retrying may work; the creator is not at fault.
"""


class ScrapeError(Exception):
    """Base class, so a caller can catch every scraping failure in one clause."""


class ScrapeConfigurationError(ScrapeError):
    """Our side is wrong: missing credentials, or a response we cannot parse."""


class ProfileNotFoundError(ScrapeError):
    """The account does not exist, is private, or returned nothing."""


class ScrapeUpstreamError(ScrapeError):
    """The provider errored, timed out, or is rate-limiting us."""
