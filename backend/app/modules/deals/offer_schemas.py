from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ProposeOfferRequest(BaseModel):
    """
    Terms one party puts to the other.

    `proposed_by` is deliberately absent: the server resolves who is proposing
    from the caller's role in the interest. Accepting it from the client would
    let a brand file an offer as though the creator had made it.
    """

    #: Upper bound is a guard against a typo becoming a contract — nobody is
    #: agreeing a hundred-crore influencer deal through this form.
    fee: Decimal = Field(gt=0, le=100_000_000)
    currency: str = "INR"
    deliverables: Optional[list[str]] = None
    deadline: Optional[date] = None
    note: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("deliverables")
    @classmethod
    def _drop_blank_lines(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        cleaned = [item.strip() for item in v if item and item.strip()]
        return cleaned or None


class OfferOut(BaseModel):
    id: int
    status: str
    proposed_by_id: int
    proposed_by_role: str
    #: True when the viewer is the one who proposed it — so the UI can decide
    #: which side to render it on, and whether to offer Accept or Withdraw.
    is_mine: bool

    fee: Decimal
    currency: str
    deliverables: Optional[list[str]] = None
    deadline: Optional[date] = None
    note: Optional[str] = None

    supersedes_id: Optional[int] = None
    created_at: datetime
    responded_at: Optional[datetime] = None


class DealTerms(BaseModel):
    """
    The state of the negotiation on one interest.

    `current` is the only offer that can be acted on; `history` is everything
    behind it, newest first. `agreed` is set once and never changes.
    """

    interest_id: int
    #: The live offer awaiting a response, if there is one.
    current: Optional[OfferOut] = None
    #: The accepted offer. Once this exists the negotiation is closed.
    agreed: Optional[OfferOut] = None
    history: list[OfferOut] = []

    #: What this viewer may do right now, so the UI never renders a control the
    #: API would reject.
    can_propose: bool = False
    can_respond: bool = False
    can_withdraw: bool = False


# ---------------------------------------------------------------------------
# Delivery (V2 §1.4)
# ---------------------------------------------------------------------------

class SubmitDeliveryRequest(BaseModel):
    """
    A creator handing over finished work.

    `label` says which agreed deliverable this is. It is validated against the
    agreed list server-side, so a creator cannot quietly satisfy "1x Reel" by
    submitting something called "a tweet".
    """

    label: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=2000)
    note: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("url")
    @classmethod
    def _looks_like_a_link(cls, v: str) -> str:
        v = v.strip()
        if not v.lower().startswith(("http://", "https://")):
            raise ValueError("Deliverable must be a link starting with http:// or https://")
        return v


class ReviewDeliveryRequest(BaseModel):
    """A brand approving, or asking for changes with a reason."""

    approve: bool
    feedback: Optional[str] = Field(default=None, max_length=2000)


class DeliveryOut(BaseModel):
    id: int
    label: str
    url: str
    note: Optional[str] = None
    status: str
    feedback: Optional[str] = None
    submitted_by_id: int
    is_mine: bool
    supersedes_id: Optional[int] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None


class DeliveryState(BaseModel):
    """Where a deal stands on delivery. Derived, never stored."""

    #: Null until terms are agreed — there is nothing to deliver against.
    offer_id: Optional[int] = None
    complete: bool = False
    #: Agreed deliverables with no approved submission yet.
    outstanding: list[str] = []
    approved_count: int = 0
    expected_count: int = 0
    submissions: list[DeliveryOut] = []

    can_submit: bool = False
    can_review: bool = False


# ---------------------------------------------------------------------------
# Reviews (V2 §1.5)
# ---------------------------------------------------------------------------

class SubmitReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)


class ReviewOut(BaseModel):
    id: int
    rating: int
    comment: Optional[str] = None
    author_role: str
    created_at: datetime


class ReviewState(BaseModel):
    """
    Where a deal's reviews stand, from this viewer's point of view.

    `received` is null until reveal, which is why this is not simply two
    optional reviews: a hidden review must be indistinguishable from one that
    was never written, or the reveal rule leaks what it is meant to protect.
    """

    #: Your own review, visible to you as soon as you write it.
    mine: Optional[ReviewOut] = None
    #: Theirs — only once revealed.
    received: Optional[ReviewOut] = None
    #: True when both sides have submitted, or the window has passed.
    revealed: bool = False
    #: False until the work is delivered; there is nothing to review before that.
    can_review: bool = False
    #: Why not, when `can_review` is false.
    blocked_reason: Optional[str] = None


class PublicReviews(BaseModel):
    """A user's track record, as anyone may see it."""

    user_id: int
    average_rating: Optional[float] = None
    review_count: int = 0
    reviews: list[ReviewOut] = []
