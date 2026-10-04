"""
The admin half of trust & safety (V2 Phase 3).

Separate from `trust/router.py` because the audiences are different and so are
the guards: everything here is behind `require_admin`, and every handler writes
down **which** admin acted. A moderation record with no name on it is not a
moderation record.

Mounted under /admin so it sits with the rest of the console rather than
appearing as a second, differently-shaped admin surface.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.core.logging import logger
from app.modules.admin.router import require_admin
from app.modules.trust.models import (
    DealDispute, DisputeStatus, ReportStatus, UserReport, VerificationStatus,
)
from app.modules.users.models import User

router = APIRouter(prefix="/admin/trust", tags=["Admin — trust & safety"])


class ReportOut(BaseModel):
    id: int
    reporter_id: int
    reporter_email: str
    reported_id: int
    reported_email: str
    interest_id: int | None
    reason: str
    detail: str | None
    status: str
    created_at: datetime
    admin_note: str | None


class ResolveReport(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=2000)


class DisputeAdminOut(BaseModel):
    id: int
    interest_id: int
    raised_by_id: int
    raised_by_email: str
    reason: str
    detail: str
    status: str
    created_at: datetime
    resolution_note: str | None


class ResolveDispute(BaseModel):
    status: str
    note: str = Field(min_length=5, max_length=2000)


class VerificationQueueOut(BaseModel):
    user_id: int
    email: str
    role: str
    status: str
    requested_at: datetime | None


class ReviewVerification(BaseModel):
    approve: bool
    note: str | None = Field(default=None, max_length=1000)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    status_filter: str = Query(default=ReportStatus.OPEN, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Oldest first, deliberately.

    Newest-first is the usual default and is wrong here: it buries the report
    that has been waiting longest under every fresh one, which is exactly the
    report most likely to concern someone still being harmed.
    """
    reporter = User.__table__.alias("reporter")
    reported = User.__table__.alias("reported")

    rows = (await db.execute(
        select(UserReport, reporter.c.email, reported.c.email)
        .join(reporter, reporter.c.id == UserReport.reporter_id)
        .join(reported, reported.c.id == UserReport.reported_id)
        .where(UserReport.status == status_filter)
        .order_by(UserReport.created_at.asc())
        .limit(200)
    )).all()

    return [
        ReportOut(
            id=r.id, reporter_id=r.reporter_id, reporter_email=reporter_email,
            reported_id=r.reported_id, reported_email=reported_email,
            interest_id=r.interest_id, reason=r.reason, detail=r.detail,
            status=r.status, created_at=r.created_at, admin_note=r.admin_note,
        )
        for r, reporter_email, reported_email in rows
    ]


@router.get("/reports/counts")
async def report_counts(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Badge counts for the console, so an unread queue is visible at a glance."""
    rows = (await db.execute(
        select(UserReport.status, func.count(UserReport.id)).group_by(UserReport.status)
    )).all()
    counts = {s: c for s, c in rows}

    open_disputes = (await db.execute(
        select(func.count(DealDispute.id)).where(DealDispute.status == DisputeStatus.OPEN)
    )).scalar() or 0

    pending_verifications = (await db.execute(
        select(func.count(User.id)).where(
            User.verification_status == VerificationStatus.PENDING
        )
    )).scalar() or 0

    return {
        "reports": counts,
        "open_disputes": open_disputes,
        "pending_verifications": pending_verifications,
    }


@router.post("/reports/{report_id}", response_model=ReportOut)
async def resolve_report(
    report_id: int,
    data: ResolveReport,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    allowed = {ReportStatus.REVIEWED, ReportStatus.ACTIONED, ReportStatus.DISMISSED}
    if data.status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Status must be one of: {', '.join(sorted(allowed))}",
        )

    report = (await db.execute(
        select(UserReport).where(UserReport.id == report_id)
    )).scalar()
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")

    report.status = data.status
    report.admin_note = (data.note or "").strip() or None
    report.reviewed_at = datetime.now(timezone.utc)
    # Who decided. Without this the queue records that something was handled
    # but not by whom, which is useless the first time a decision is questioned.
    report.reviewed_by_id = admin.id
    await db.commit()

    logger.info("Admin {} marked report {} as {}", admin.id, report_id, data.status)

    reporter_email = (await db.execute(
        select(User.email).where(User.id == report.reporter_id)
    )).scalar() or ""
    reported_email = (await db.execute(
        select(User.email).where(User.id == report.reported_id)
    )).scalar() or ""

    return ReportOut(
        id=report.id, reporter_id=report.reporter_id, reporter_email=reporter_email,
        reported_id=report.reported_id, reported_email=reported_email,
        interest_id=report.interest_id, reason=report.reason, detail=report.detail,
        status=report.status, created_at=report.created_at,
        admin_note=report.admin_note,
    )


# ---------------------------------------------------------------------------
# Disputes
# ---------------------------------------------------------------------------

@router.get("/disputes", response_model=list[DisputeAdminOut])
async def list_disputes(
    status_filter: str = Query(default=DisputeStatus.OPEN, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = (await db.execute(
        select(DealDispute, User.email)
        .join(User, User.id == DealDispute.raised_by_id)
        .where(DealDispute.status == status_filter)
        .order_by(DealDispute.created_at.asc())
        .limit(200)
    )).all()

    return [
        DisputeAdminOut(
            id=d.id, interest_id=d.interest_id, raised_by_id=d.raised_by_id,
            raised_by_email=email, reason=d.reason, detail=d.detail,
            status=d.status, created_at=d.created_at,
            resolution_note=d.resolution_note,
        )
        for d, email in rows
    ]


@router.post("/disputes/{dispute_id}", response_model=DisputeAdminOut)
async def resolve_dispute(
    dispute_id: int,
    data: ResolveDispute,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Close a dispute with a written outcome.

    The note is required, not optional. Both parties can see it, and a dispute
    that closes with no explanation is worse than one left open — it tells the
    person who raised it that they were overruled without saying why.

    Resolving changes nothing about the delivery record or the agreed terms.
    V2's scope is the flag and admin visibility; anything that edited the
    evidence would defeat the point of keeping it immutable.
    """
    allowed = {DisputeStatus.RESOLVED, DisputeStatus.DISMISSED}
    if data.status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Status must be one of: {', '.join(sorted(allowed))}",
        )

    dispute = (await db.execute(
        select(DealDispute).where(DealDispute.id == dispute_id)
    )).scalar()
    if dispute is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispute not found")

    dispute.status = data.status
    dispute.resolution_note = data.note.strip()
    dispute.resolved_at = datetime.now(timezone.utc)
    dispute.resolved_by_id = admin.id
    await db.commit()

    logger.info("Admin {} {} dispute {}", admin.id, data.status, dispute_id)

    email = (await db.execute(
        select(User.email).where(User.id == dispute.raised_by_id)
    )).scalar() or ""

    return DisputeAdminOut(
        id=dispute.id, interest_id=dispute.interest_id,
        raised_by_id=dispute.raised_by_id, raised_by_email=email,
        reason=dispute.reason, detail=dispute.detail, status=dispute.status,
        created_at=dispute.created_at, resolution_note=dispute.resolution_note,
    )


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

@router.get("/verifications", response_model=list[VerificationQueueOut])
async def verification_queue(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = (await db.execute(
        select(User)
        .where(User.verification_status == VerificationStatus.PENDING)
        .order_by(User.verification_requested_at.asc())
        .limit(200)
    )).scalars().all()

    return [
        VerificationQueueOut(
            user_id=u.id, email=u.email, role=u.role,
            status=u.verification_status, requested_at=u.verification_requested_at,
        )
        for u in rows
    ]


@router.post("/verifications/{user_id}", response_model=VerificationQueueOut)
async def review_verification(
    user_id: int,
    data: ReviewVerification,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Approve or reject a verification request.

    A rejection requires a note: the user can request again, and "rejected"
    with no reason leaves them resubmitting the same thing forever.
    """
    note = (data.note or "").strip() or None
    if not data.approve and not note:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Say why it was rejected so they know what to fix.",
        )

    user = (await db.execute(select(User).where(User.id == user_id))).scalar()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if user.verification_status != VerificationStatus.PENDING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account has no verification request waiting.",
        )

    user.verification_status = (
        VerificationStatus.VERIFIED if data.approve else VerificationStatus.REJECTED
    )
    user.verification_note = note
    user.verification_reviewed_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info(
        "Admin {} {} verification for user {}",
        admin.id, "approved" if data.approve else "rejected", user_id,
    )

    return VerificationQueueOut(
        user_id=user.id, email=user.email, role=user.role,
        status=user.verification_status, requested_at=user.verification_requested_at,
    )
