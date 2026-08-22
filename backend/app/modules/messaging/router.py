"""
Messaging between a brand and a creator, scoped to the interest that
introduced them.

Every route resolves the thread through `opportunity_interests` and checks
that the caller is one of its two participants — the same explicit-ownership
pattern as campaigns (`campaigns/router.py`), for the same reason: a check
that can be forgotten is how the unauthenticated profile routes happened.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.common.rate_limit import rate_limit_user
from app.core.logging import logger
from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.messaging.models import Message
from app.modules.messaging.schemas import (
    Counterpart, MessageOut, SendMessageRequest, ThreadDetail, ThreadSummary,
)
from app.modules.users.models import BrandProfile, CreatorProfile, User

router = APIRouter(prefix="/messages", tags=["Messaging"])


async def _owned_interest(db: AsyncSession, user_id: int, interest_id: int) -> OpportunityInterest:
    interest = (await db.execute(
        select(OpportunityInterest).where(OpportunityInterest.id == interest_id)
    )).scalar()

    # 404, not 403: matches campaigns/router.py's _owned_campaign — the
    # existence of a thread this user isn't part of is not disclosed.
    if interest is None or user_id not in (interest.creator_id, interest.brand_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")

    return interest


async def _counterpart(db: AsyncSession, current_user_id: int, interest: OpportunityInterest) -> Counterpart:
    """
    Resolve who the current user is talking to.

    This is the one place a creator's thread reveals the brand's identity —
    deliberately, and only here. Nothing in the opportunity-generation or
    anonymity-scrubbing code changes; a creator who has not expressed
    interest still never sees a brand name anywhere else.
    """
    if current_user_id == interest.creator_id:
        brand_profile = (await db.execute(
            select(BrandProfile).where(BrandProfile.user_id == interest.brand_id)
        )).scalar()
        return Counterpart(
            user_id=interest.brand_id,
            name=brand_profile.brand_name if brand_profile else "Brand",
            subtitle=brand_profile.industry if brand_profile else None,
            location=brand_profile.target_location if brand_profile else None,
        )

    creator_profile = (await db.execute(
        select(CreatorProfile).where(CreatorProfile.user_id == interest.creator_id)
    )).scalar()
    return Counterpart(
        user_id=interest.creator_id,
        name=creator_profile.full_name if creator_profile else "Creator",
        subtitle=creator_profile.category if creator_profile else None,
        location=creator_profile.location if creator_profile else None,
    )


@router.get("/threads", response_model=list[ThreadSummary])
async def list_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """This user's threads — every interest they're a participant in that has
    at least one message — newest activity first."""
    interests = list((await db.execute(
        select(OpportunityInterest).where(
            or_(
                OpportunityInterest.creator_id == current_user.id,
                OpportunityInterest.brand_id == current_user.id,
            )
        )
    )).scalars().all())

    if not interests:
        return []

    interest_ids = [i.id for i in interests]

    # One query for the last message per thread, one for unread counts,
    # rather than N queries per interest.
    last_messages: dict[int, Message] = {}
    for m in (await db.execute(
        select(Message)
        .where(Message.interest_id.in_(interest_ids))
        .order_by(Message.interest_id, Message.created_at.desc())
    )).scalars().all():
        last_messages.setdefault(m.interest_id, m)

    unread_counts = dict((await db.execute(
        select(Message.interest_id, func.count(Message.id))
        .where(
            Message.interest_id.in_(interest_ids),
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
        .group_by(Message.interest_id)
    )).all())

    summaries = []
    for interest in interests:
        last = last_messages.get(interest.id)
        if last is None:
            continue  # No conversation yet — not a thread worth listing.
        summaries.append(ThreadSummary(
            interest_id=interest.id,
            counterpart=await _counterpart(db, current_user.id, interest),
            last_message=last.body,
            last_message_at=last.created_at,
            unread_count=unread_counts.get(interest.id, 0),
            interest_status=interest.status,
        ))

    summaries.sort(key=lambda s: s.last_message_at, reverse=True)
    return summaries


@router.get("/threads/{interest_id}", response_model=ThreadDetail)
async def get_thread(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interest = await _owned_interest(db, current_user.id, interest_id)

    messages = list((await db.execute(
        select(Message)
        .where(Message.interest_id == interest_id)
        .order_by(Message.created_at)
    )).scalars().all())

    return ThreadDetail(
        interest_id=interest.id,
        counterpart=await _counterpart(db, current_user.id, interest),
        interest_status=interest.status,
        messages=[
            MessageOut(
                id=m.id, sender_id=m.sender_id, body=m.body,
                created_at=m.created_at, read_at=m.read_at,
                is_mine=(m.sender_id == current_user.id),
            )
            for m in messages
        ],
    )


@router.post(
    "/threads/{interest_id}",
    response_model=MessageOut,
    status_code=201,
    dependencies=[rate_limit_user(60, 3600, "send_message")],
)
async def send_message(
    interest_id: int,
    data: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interest = await _owned_interest(db, current_user.id, interest_id)

    if interest.status != InterestStatus.INTERESTED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This interest was withdrawn — the thread is closed.",
        )

    body = data.body.strip()
    if not body:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message cannot be empty")

    message = Message(interest_id=interest_id, sender_id=current_user.id, body=body)
    db.add(message)
    await db.commit()
    await db.refresh(message)

    logger.info("User {} sent a message on interest {}", current_user.id, interest_id)

    return MessageOut(
        id=message.id, sender_id=message.sender_id, body=message.body,
        created_at=message.created_at, read_at=message.read_at, is_mine=True,
    )


@router.post("/threads/{interest_id}/read")
async def mark_read(
    interest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks the counterpart's unread messages as read by this user."""
    await _owned_interest(db, current_user.id, interest_id)

    unread = list((await db.execute(
        select(Message).where(
            Message.interest_id == interest_id,
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
    )).scalars().all())

    now = datetime.now(timezone.utc)
    for m in unread:
        m.read_at = now
    await db.commit()

    return {"marked_read": len(unread)}


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Total unread messages across every thread this user is part of, for a
    navbar badge."""
    count = (await db.execute(
        select(func.count(Message.id))
        .join(OpportunityInterest, OpportunityInterest.id == Message.interest_id)
        .where(
            or_(
                OpportunityInterest.creator_id == current_user.id,
                OpportunityInterest.brand_id == current_user.id,
            ),
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
    )).scalar() or 0

    return {"unread_count": count}
