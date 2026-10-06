"""
Sending through Resend (https://resend.com/docs/api-reference/emails/send-email).

One small class behind a protocol, so tests swap in a fake and nothing in the
test suite can reach the network.
"""

from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.core.config import settings


@dataclass
class OutgoingEmail:
    to: str
    subject: str
    html: str
    text: str
    #: Resend keeps this for 24 hours, so a retry after a timeout whose send
    #: actually succeeded does not deliver the email twice.
    idempotency_key: str
    headers: dict[str, str] = field(default_factory=dict)
    tags: dict[str, str] = field(default_factory=dict)


class SendError(Exception):
    """A send that failed. `retryable` is False for errors a retry cannot fix."""

    def __init__(self, message: str, *, retryable: bool = True, rate_limited: bool = False):
        super().__init__(message)
        self.retryable = retryable
        self.rate_limited = rate_limited


class EmailSender(Protocol):
    async def send(self, email: OutgoingEmail) -> str: ...


class ResendSender:
    URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str | None = None, timeout: float = 10.0):
        self.api_key = api_key or settings.resend_api_key
        self.timeout = timeout

    async def send(self, email: OutgoingEmail) -> str:
        payload = {
            "from": settings.email_from,
            "to": [email.to],
            "subject": email.subject,
            "html": email.html,
            "text": email.text,
        }
        if settings.email_reply_to:
            payload["reply_to"] = settings.email_reply_to
        if email.headers:
            payload["headers"] = email.headers
        if email.tags:
            payload["tags"] = [{"name": k, "value": v} for k, v in email.tags.items()]

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(
                    self.URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Idempotency-Key": email.idempotency_key,
                    },
                )
        except httpx.HTTPError as exc:
            raise SendError(f"network: {type(exc).__name__}") from exc

        if res.status_code == 200:
            return str(res.json().get("id", ""))
        if res.status_code == 429:
            raise SendError("rate limited", rate_limited=True)
        # 4xx other than 429 is our fault (bad address, unverified domain):
        # retrying sends the same bad request again.
        detail = res.text[:200]
        raise SendError(f"{res.status_code}: {detail}", retryable=res.status_code >= 500)


def default_sender() -> EmailSender:
    return ResendSender()
