"""
Trust & safety endpoints for the two people in a deal (V2 Phase 3).

Admin review lives in `admin/router.py` behind `require_roles("ADMIN")`; this
module is what a brand or creator can do about the person on the other side.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.common.rate_limit import rate_limit_user
from app.core.logging import logger
from app.modules.deals.models import OpportunityInterest
from app.modules.trust.service import is_blocked_between
from app.modules.trust.models import (
    DealDispute, DisputeStatus, ReportReason, UserBlock, UserReport,
    VerificationStatus,
)
from app.modules.users.models import User

router = APIRouter(prefix="/trust", tags=["Trust & safety"])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _party_interest(
    db: AsyncSession, user_id: int, interest_id: int
) -> OpportunityInterest:
    interest = (await db.execute(
        select(OpportunityInterest).where(OpportunityInterest.id == interest_id)
    )).scalar()

    # 404 rather than 403, matching messaging and campaigns: the existence of a
    # deal this user is not part of is not disclosed.
    if interest is None or user_id not in (interest.creator_id, interest.brand_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deal not found")

    return interest


# ---------------------------------------------------------------------------
# Blocking
# ---------------------------------------------------------------------------

class BlockRequest(BaseModel):
    interest_id: int


class BlockState(BaseModel):
    blocked: bool
    #: True when *this* user did the blocking, so the UI can offer Unblock
    #: rather than implying they can undo someone else's decision.
    blocked_by_me: bool


@router.post("/block", response_model=BlockState)
async def block_counterpart(
    data: BlockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stop further messages with the other party on this deal.

    The thread is not deleted or hidden. Both sides keep seeing every message
    already sent, because that conversation is the evidence for any report
    filed about it — and because making messages vanish would let someone erase
    what they said by blocking the person they said it to.
    """
    # Read the id out before any write. `rollback()` below expires every object
    # in the session, so `current_user.id` afterwards would trigger a lazy
    # reload outside the async context and raise MissingGreenlet — turning the
    # harmless "blocked twice" case into a 500.
    me_id = current_user.id

    interest = await _party_interest(db, me_id, data.interest_id)
    other_id = (
        interest.brand_id if me_id == interest.creator_id else interest.creator_id
    )

    db.add(UserBlock(blocker_id=me_id, blocked_id=other_id))
    try:
        await db.commit()
    except IntegrityError:
        # uq_user_blocks_pair — already blocked, from a double submit or a
        # second tab. The desired state is the current state, so this is a
        # success, not an error.
        await db.rollback()

    logger.info("User {} blocked user {}", me_id, other_id)
    return BlockState(blocked=True, blocked_by_me=True)


@router.post("/unblock", response_model=BlockState)
async def unblock_counterpart(
    data: BlockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Undo your own block.

    Only your own: a block placed by the other party is theirs to lift. If both
    sides have blocked, removing one still leaves the pair blocked, which is
    why the response reports the *combined* state rather than assuming this
    call cleared it.
    """
    interest = await _party_interest(db, current_user.id, data.interest_id)
    other_id = (
        interest.brand_id if current_user.id == interest.creator_id
        else interest.creator_id
    )

    mine = (await db.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == current_user.id,
            UserBlock.blocked_id == other_id,
        )
    )).scalar()

    if mine is not None:
        await db.delete(mine)
        await db.commit()
        logger.info("User {} unblocked user {}", current_user.id, other_id)

    still_blocked = await is_blocked_between(db, current_user.id, other_id)
    return BlockState(blocked=still_blocked, blocked_by_me=False)


@router.get("/block/{interest_id}", response_model=BlockState)
async def block_state(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interest = await _party_interest(db, current_user.id, interest_id)
    other_id = (
        interest.brand_id if current_user.id == interest.creator_id
        else interest.creator_id
    )

    mine = (await db.execute(
        select(UserBlock.id).where(
            UserBlock.blocker_id == current_user.id,
            UserBlock.blocked_id == other_id,
        )
    )).scalar()

    return BlockState(
        blocked=await is_blocked_between(db, current_user.id, other_id),
        blocked_by_me=mine is not None,
    )


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

class ReportRequest(BaseModel):
    interest_id: int
    reason: str
    detail: str | None = Field(default=None, max_length=2000)


@router.post(
    "/report",
    status_code=status.HTTP_201_CREATED,
    # Per account, not per IP: a report queue is a human's time, and the cost
    # of flooding it is paid by whoever has to read it.
    dependencies=[rate_limit_user(20, 3600, "report_user")],
)
async def report_counterpart(
    data: ReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Report the other party to Crewaa's admins.

    The reported person is **never notified** — not now, not when an admin
    reviews it. A report that tells its subject invites retaliation, and the
    first thing anyone would learn is that reporting makes things worse.

    Reporting does not block. They are separate on purpose: plenty of people
    want the behaviour on record without ending a deal that is otherwise fine,
    and forcing the two together means the ones who cannot afford to end it
    simply never report.
    """
    if data.reason not in ReportReason.ALL:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown reason. Expected one of: {', '.join(sorted(ReportReason.ALL))}",
        )

    detail = (data.detail or "").strip() or None
    if data.reason == ReportReason.OTHER and not detail:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Tell us what happened so an admin can look into it.",
        )

    interest = await _party_interest(db, current_user.id, data.interest_id)
    other_id = (
        interest.brand_id if current_user.id == interest.creator_id
        else interest.creator_id
    )

    db.add(UserReport(
        reporter_id=current_user.id,
        reported_id=other_id,
        interest_id=interest.id,
        reason=data.reason,
        detail=detail,
    ))
    await db.commit()

    logger.info(
        "User {} reported user {} ({})", current_user.id, other_id, data.reason
    )

    # Nothing about the report comes back beyond acknowledgement. Returning its
    # id or status would give the reporter something to quote at the person
    # they reported.
    return {"received": True}


# ---------------------------------------------------------------------------
# Disputes
# ---------------------------------------------------------------------------

class DisputeRequest(BaseModel):
    reason: str = Field(max_length=32)
    detail: str = Field(min_length=10, max_length=2000)


class DisputeOut(BaseModel):
    id: int
    status: str
    reason: str
    detail: str
    created_at: datetime
    raised_by_me: bool
    resolution_note: str | None = None


@router.post(
    "/disputes/{interest_id}",
    response_model=DisputeOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limit_user(10, 3600, "raise_dispute")],
)
async def raise_dispute(
    interest_id: int,
    data: DisputeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Flag a deal as contested.

    This records a disagreement; it does not resolve one, and it deliberately
    changes nothing about the delivery or the agreed terms. The submissions and
    the accepted offer are the evidence an admin will read — a dispute that
    could alter them would let either party rewrite the record the argument is
    about.

    `detail` has a minimum length because "it's wrong" gives an admin nothing
    to act on and the other party nothing to answer.
    """
    # Captured before the write, for the same reason as block_counterpart: the
    # rollback below expires the session and a later attribute read would fail.
    me_id = current_user.id

    await _party_interest(db, me_id, interest_id)

    dispute = DealDispute(
        interest_id=interest_id,
        raised_by_id=me_id,
        reason=data.reason.strip(),
        detail=data.detail.strip(),
        status=DisputeStatus.OPEN,
    )
    db.add(dispute)

    try:
        await db.commit()
    except IntegrityError:
        # uq_deal_disputes_one_open fired: this deal is already contested.
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This deal is already under dispute. An admin is reviewing it.",
        )

    await db.refresh(dispute)
    logger.info("User {} disputed interest {}", me_id, interest_id)

    return DisputeOut(
        id=dispute.id, status=dispute.status, reason=dispute.reason,
        detail=dispute.detail, created_at=dispute.created_at,
        raised_by_me=True, resolution_note=dispute.resolution_note,
    )


@router.get("/disputes/{interest_id}", response_model=list[DisputeOut])
async def list_disputes(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Both parties see every dispute on their deal, including one raised against
    them. Being disputed without being told would make the record useless as a
    prompt to sort the problem out.
    """
    await _party_interest(db, current_user.id, interest_id)

    rows = (await db.execute(
        select(DealDispute)
        .where(DealDispute.interest_id == interest_id)
        .order_by(DealDispute.created_at.desc())
    )).scalars().all()

    return [
        DisputeOut(
            id=d.id, status=d.status, reason=d.reason, detail=d.detail,
            created_at=d.created_at, raised_by_me=d.raised_by_id == current_user.id,
            resolution_note=d.resolution_note,
        )
        for d in rows
    ]


# ---------------------------------------------------------------------------
# Verification (the user's half; admins review in admin/router.py)
# ---------------------------------------------------------------------------

class VerificationOut(BaseModel):
    status: str
    requested_at: datetime | None = None
    reviewed_at: datetime | None = None
    note: str | None = None


@router.get("/verification", response_model=VerificationOut)
async def my_verification(current_user: User = Depends(get_current_user)):
    return VerificationOut(
        status=current_user.verification_status,
        requested_at=current_user.verification_requested_at,
        reviewed_at=current_user.verification_reviewed_at,
        note=current_user.verification_note,
    )


@router.post(
    "/verification",
    response_model=VerificationOut,
    dependencies=[rate_limit_user(5, 86400, "request_verification")],
)
async def request_verification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ask an admin to verify this account.

    Manual review by decision #4 — cheap to build, does not scale, and that is
    an accepted trade until review volume makes it a bottleneck.

    Re-requesting after a rejection is allowed: a rejection usually means
    something fixable, and the note says what. Re-requesting while already
    verified is not, since there is nothing to review.
    """
    if current_user.verification_status == VerificationStatus.VERIFIED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This account is already verified."
        )
    if current_user.verification_status == VerificationStatus.PENDING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A verification request is already waiting for review.",
        )

    current_user.verification_status = VerificationStatus.PENDING
    current_user.verification_requested_at = datetime.now(timezone.utc)
    # Clear a previous rejection's note so stale feedback is not shown against
    # a fresh request.
    current_user.verification_note = None
    current_user.verification_reviewed_at = None
    await db.commit()

    logger.info("User {} requested verification", current_user.id)

    return VerificationOut(
        status=current_user.verification_status,
        requested_at=current_user.verification_requested_at,
    )
