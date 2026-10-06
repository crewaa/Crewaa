from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.models.user import User
from app.modules.authenticity.models import AuthenticityReport
from app.modules.authenticity.schemas import AuthenticityPlatformReport, AuthenticityResponse

router = APIRouter(prefix="/authenticity", tags=["Authenticity"])


@router.get("/{user_id}", response_model=AuthenticityResponse)
async def get_authenticity(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Full authenticity report for a creator.

    Readable by the creator themselves, admins, and brands. Brands already see
    a creator's public stats in discovery; the score is derived only from that
    same public data, so showing it to them discloses nothing new.
    Other creators may not read each other's reports.
    """
    if current_user.id != user_id and current_user.role not in ("ADMIN", "BRAND"):
        raise HTTPException(403, "You can only view your own authenticity report.")

    rows = (await db.execute(
        select(AuthenticityReport)
        .where(AuthenticityReport.user_id == user_id)
        .order_by(AuthenticityReport.platform)
    )).scalars().all()

    return AuthenticityResponse(
        creator_id=user_id,
        reports=[
            AuthenticityPlatformReport(
                platform=r.platform, score=r.score, level=r.level, signals=r.signals or [],
                audience=r.audience, computed_at=r.computed_at,
            )
            for r in rows
        ],
    )
