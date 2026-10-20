"""
Messaging between a brand and a creator, scoped to the interest that
introduced them.

Every route resolves the thread through `opportunity_interests` and checks
that the caller is one of its two participants — the same explicit-ownership
pattern as campaigns (`campaigns/router.py`), for the same reason: a check
that can be forgotten is how the unauthenticated profile routes happened.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.common.rate_limit import rate_limit_user
from app.core.logging import logger
from app.modules.campaigns.models import Campaign, CampaignStatus
from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.instagram.models.instagram import InstagramProfile
from app.modules.messaging.models import Message
from app.modules.messaging.schemas import (
    Counterpart, MessageOut, SendMessageRequest, StartThreadRequest, ThreadDetail, ThreadSummary,
)
from app.modules.notifications.models import NotificationKind
from app.modules.trust.service import is_blocked_between
from app.modules.notifications.service import counterpart_id, notify, thread_link
from app.modules.users.models import BrandProfile, CreatorProfile, User
from app.modules.youtube.models import YouTubeChannel

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
            avatar_url=brand_profile.logo_url if brand_profile else None,
        )

    creator_profile = (await db.execute(
        select(CreatorProfile).where(CreatorProfile.user_id == interest.creator_id)
    )).scalar()

    # Resolve creator avatar from Instagram or YouTube
    avatar_url = None
    ig = (await db.execute(
        select(InstagramProfile.profile_picture)
        .where(InstagramProfile.user_id == interest.creator_id)
        .order_by(InstagramProfile.scraped_at.desc())
    )).scalars().first()

    yt = (await db.execute(
        select(YouTubeChannel.profile_picture)
        .where(YouTubeChannel.user_id == interest.creator_id)
        .order_by(YouTubeChannel.scraped_at.desc())
    )).scalars().first()

    # If Instagram URL has expired signature, prefer non-expiring YouTube picture
    ig_expired = False
    if ig and "oe=" in ig:
        try:
            oe_hex = ig.split("oe=")[1].split("&")[0]
            exp_ts = int(oe_hex, 16)
            ig_expired = datetime.now(timezone.utc).timestamp() > (exp_ts - 300)
        except Exception:
            ig_expired = False

    if ig and not ig_expired:
        avatar_url = ig
    elif yt:
        avatar_url = yt
    elif ig:
        avatar_url = ig

    return Counterpart(
        user_id=interest.creator_id,
        name=creator_profile.full_name if creator_profile else "Creator",
        subtitle=creator_profile.category if creator_profile else None,
        location=creator_profile.location if creator_profile else None,
        avatar_url=avatar_url,
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

    # Blocking is checked here, at send, rather than by hiding the thread.
    # Both sides keep reading everything already said — that conversation is
    # the evidence for any report filed about it, and letting a block erase it
    # would mean you could unsay things by blocking whoever you said them to.
    recipient_id = counterpart_id(interest, current_user.id)
    if await is_blocked_between(db, current_user.id, recipient_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Messaging is blocked on this deal. You can still see the "
            "conversation, but neither of you can send anything new.",
        )

    message = Message(interest_id=interest_id, sender_id=current_user.id, body=body)
    db.add(message)

    # Staged on the same session, committed by the same commit below: a
    # notification must not be able to exist for a message that failed to save.
    sender = await _counterpart(db, recipient_id, interest)
    await notify(
        db,
        user_id=recipient_id,
        kind=NotificationKind.MESSAGE,
        title=f"New message from {sender.name}",
        # Truncated, not full: the bell is a prompt to go and read the thread,
        # and a long message would push every other notification off screen.
        body=body[:140] + ("…" if len(body) > 140 else ""),
        link=thread_link(interest_id),
        interest_id=interest_id,
        # Ten messages in one conversation are one thing to look at.
        collapse=True,
    )

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


@router.post("/start", response_model=ThreadDetail)
async def start_or_get_thread(
    data: StartThreadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start or retrieve a conversation thread with a creator or brand.
    If a thread already exists between the two users, it is reused.
    If not, an OpportunityInterest is created to anchor the conversation.
    If an initial message is provided, it is sent and the recipient is notified.
    """
    recipient = (await db.execute(
        select(User).where(User.id == data.creator_id)
    )).scalar()
    if not recipient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recipient user not found")

    # Determine brand and creator IDs based on caller and recipient roles
    if current_user.role == "BRAND":
        brand_id = current_user.id
        creator_id = data.creator_id
    elif recipient.role == "BRAND":
        brand_id = recipient.id
        creator_id = current_user.id
    else:
        brand_id = current_user.id
        creator_id = data.creator_id

    # Check for an existing thread between these two parties
    existing_interest = (await db.execute(
        select(OpportunityInterest).where(
            OpportunityInterest.brand_id == brand_id,
            OpportunityInterest.creator_id == creator_id,
            OpportunityInterest.status == InterestStatus.INTERESTED,
        ).order_by(OpportunityInterest.created_at.desc())
    )).scalars().first()

    if existing_interest:
        interest = existing_interest
    else:
        camp_id = data.campaign_id
        if not camp_id:
            camp_id = (await db.execute(
                select(Campaign.id).where(
                    Campaign.brand_id == brand_id,
                    Campaign.status == CampaignStatus.ACTIVE,
                ).order_by(Campaign.created_at.desc())
            )).scalars().first()

        opp_id = f"outreach_{uuid.uuid4().hex[:12]}"
        interest = OpportunityInterest(
            creator_id=creator_id,
            brand_id=brand_id,
            campaign_id=camp_id,
            opportunity_id=opp_id,
            status=InterestStatus.INTERESTED,
            opportunity_snapshot=json.dumps({
                "type": "direct_outreach",
                "initiated_by": current_user.id,
            }),
            message=data.message,
        )
        db.add(interest)
        await db.flush()

    # If an initial message was provided, send it
    if data.message and data.message.strip():
        body = data.message.strip()
        recipient_id = counterpart_id(interest, current_user.id)

        if not await is_blocked_between(db, current_user.id, recipient_id):
            message = Message(
                interest_id=interest.id,
                sender_id=current_user.id,
                body=body,
            )
            db.add(message)

            sender = await _counterpart(db, recipient_id, interest)
            await notify(
                db,
                user_id=recipient_id,
                kind=NotificationKind.MESSAGE,
                title=f"New message from {sender.name}",
                body=body[:140] + ("…" if len(body) > 140 else ""),
                link=thread_link(interest.id),
                interest_id=interest.id,
                collapse=True,
            )

    await db.commit()

    messages = list((await db.execute(
        select(Message)
        .where(Message.interest_id == interest.id)
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


@router.get("/threads/by-creator/{creator_id}")
async def get_thread_by_creator(
    creator_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if an active thread already exists with a specific creator."""
    interest = (await db.execute(
        select(OpportunityInterest).where(
            or_(
                (OpportunityInterest.brand_id == current_user.id) & (OpportunityInterest.creator_id == creator_id),
                (OpportunityInterest.brand_id == creator_id) & (OpportunityInterest.creator_id == current_user.id),
            ),
            OpportunityInterest.status == InterestStatus.INTERESTED,
        ).order_by(OpportunityInterest.created_at.desc())
    )).scalars().first()

    return {"interest_id": interest.id if interest else None}
