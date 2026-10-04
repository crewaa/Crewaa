"""
Raising a notification.

`notify()` stages a row on the caller's session and does **not** commit. That is
deliberate: the notification and the thing it describes must land in the same
transaction. Committing here instead would make it possible to tell a creator
"you have a new offer" for an offer whose own commit then failed — a message
about something that never happened, which is worse than no message at all.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification


async def notify(
    db: AsyncSession,
    *,
    user_id: int,
    kind: str,
    title: str,
    body: str,
    link: str,
    interest_id: int | None = None,
    collapse: bool = False,
) -> None:
    """
    Stage a notification for `user_id`. The caller commits.

    `collapse=True` folds this into the recipient's existing *unread*
    notification of the same kind on the same thread, if there is one, instead
    of adding another row. Ten messages in a conversation are one thing to look
    at, not ten; without this the bell becomes a counter of individual messages
    and people stop reading it. Read notifications are never collapsed into —
    something already seen should not silently change under the reader.
    """
    if collapse and interest_id is not None:
        existing = (await db.execute(
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.kind == kind,
                Notification.interest_id == interest_id,
                Notification.read_at.is_(None),
            )
            .order_by(Notification.created_at.desc())
        )).scalars().first()

        if existing is not None:
            existing.title = title
            existing.body = body
            existing.link = link
            # Move it back to the top of the list: the newest activity on a
            # thread is what makes it worth looking at now.
            existing.created_at = datetime.now(timezone.utc)
            return

    db.add(Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        link=link,
        interest_id=interest_id,
    ))


def counterpart_id(interest, actor_id: int) -> int:
    """
    The other party on an interest.

    Notifications always go to whoever did *not* act. Computed from the
    interest rather than passed in, because "notify the other one" written out
    by hand at each call site is exactly the kind of thing that eventually gets
    written backwards.
    """
    return interest.brand_id if actor_id == interest.creator_id else interest.creator_id


def thread_link(interest_id: int) -> str:
    """
    Where a deal notification opens.

    Offers, delivery and reviews are all rendered inside the message thread
    rather than on pages of their own, so every one of them points here.
    """
    return f"/dashboard/messages/{interest_id}"
