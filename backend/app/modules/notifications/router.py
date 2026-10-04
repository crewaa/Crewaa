"""
Notification endpoints.

Three routes, all scoped to the caller: there is no notion of reading someone
else's feed, so every query filters on `current_user.id` rather than taking an
id from the request.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.modules.notifications.models import Notification
from app.modules.users.models import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])

#: The bell shows a recent window, not an archive. Someone with 400 unread
#: notifications is not going to scroll them, and an unbounded list is a slow
#: query on every dashboard load.
PAGE_SIZE = 30


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    link: str
    created_at: datetime
    read: bool


class UnreadCount(BaseModel):
    unread: int


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(PAGE_SIZE)
    )).scalars().all()

    return [
        NotificationOut(
            id=n.id, kind=n.kind, title=n.title, body=n.body, link=n.link,
            created_at=n.created_at, read=n.read_at is not None,
        )
        for n in rows
    ]


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Polled by the navbar, so it counts rather than fetching. Returning the rows
    and counting them client-side would pull the whole feed on a timer.
    """
    total = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
    )).scalar() or 0

    return UnreadCount(unread=total)


@router.post("/read", response_model=UnreadCount)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Opening the bell marks the lot read — that is what opening it means."""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return UnreadCount(unread=0)


@router.post("/{notification_id}/read", response_model=UnreadCount)
async def mark_one_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            # Scoped to the caller in the query itself. Fetching by id and
            # checking ownership afterwards is the pattern that produced the
            # unauthenticated profile routes.
            Notification.user_id == current_user.id,
        )
    )).scalar()

    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()

    remaining = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
    )).scalar() or 0

    return UnreadCount(unread=remaining)
