"""
Trust logic other modules need.

`is_blocked_between` lives here rather than in `trust/router.py` because
`messaging/router.py` has to call it on every send. A router importing a helper
out of another router works until the day the dependency runs the other way,
at which point it is a circular import — and the fix at that point is this
file anyway. Service functions belong beside the models, not behind an HTTP
handler.
"""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.trust.models import UserBlock


async def is_blocked_between(db: AsyncSession, a_id: int, b_id: int) -> bool:
    """
    True if **either** party has blocked the other.

    Symmetric deliberately. A one-way block would let the blocker keep sending
    while the blocked person cannot reply — a mute button that still lets you
    shout. See CLAUDE.md rule 23.
    """
    row = (await db.execute(
        select(UserBlock.id).where(
            or_(
                (UserBlock.blocker_id == a_id) & (UserBlock.blocked_id == b_id),
                (UserBlock.blocker_id == b_id) & (UserBlock.blocked_id == a_id),
            )
        ).limit(1)
    )).scalar()
    return row is not None
