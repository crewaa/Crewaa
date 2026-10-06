from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.common.rate_limit import rate_limit
from app.core.logging import logger
from app.modules.admin.router import require_admin
from app.modules.email.service import stage_email
from app.modules.users.models import User
from app.modules.waitlist.models import WaitlistEntry

router = APIRouter(tags=["Waitlist"])

#: Products that accept sign-ups. Grow and the Marketing Suite are not here on
#: purpose — they are "coming soon" with no form (VERSION-3-PLAN.md decision 16).
Product = Literal["ai_influencers"]


class WaitlistJoin(BaseModel):
    product: Product
    email: EmailStr
    name: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=160)


class WaitlistEntryOut(BaseModel):
    id: int
    product: str
    email: str
    name: str | None
    company: str | None
    user_id: int | None
    created_at: datetime


class WaitlistPage(BaseModel):
    entries: list[WaitlistEntryOut]
    total: int


@router.post("/waitlist", dependencies=[rate_limit(5, 3600, "waitlist")])
async def join_waitlist(data: WaitlistJoin, db: AsyncSession = Depends(get_db)):
    """
    Public: anyone can join from the marketing site.

    Idempotent, and the answer is the same whether or not the email was already
    on the list — otherwise this endpoint would tell anyone which addresses have
    signed up. Rate-limited per IP to keep spam out.
    """
    email = data.email.strip().lower()
    exists = (await db.execute(
        select(WaitlistEntry.id).where(WaitlistEntry.product == data.product, WaitlistEntry.email == email)
    )).scalar()
    if exists is None:
        user_id = (await db.execute(select(User.id).where(func.lower(User.email) == email))).scalar()
        db.add(WaitlistEntry(
            product=data.product, email=email,
            name=(data.name or "").strip() or None, company=(data.company or "").strip() or None,
            user_id=user_id,
        ))
        # Only on the first sign-up, so the form can't be used to send the same
        # address repeated emails.
        await stage_email(
            db, kind="waitlist", to_email=email,
            subject="You're on the AI Influencers waitlist",
            body=("Thanks for your interest in Crewaa AI Influencers: an AI influencer with your "
                  "brand's look and voice, with every post clearly labelled as AI-generated."
                  "\n\nWe'll email you once when it opens. Until then, you can find creators "
                  "for your brand on Crewaa Collabs."),
            link="/collabs", cta_label="Explore Collabs",
        )
        await db.commit()
        logger.info("Waitlist sign-up for {}", data.product)
    return {"status": "joined", "product": data.product}


@router.get("/admin/waitlist", response_model=WaitlistPage)
async def list_waitlist(
    product: Product | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = select(WaitlistEntry).order_by(WaitlistEntry.created_at.desc(), WaitlistEntry.id.desc())
    if product:
        query = query.where(WaitlistEntry.product == product)
    rows = (await db.execute(query.limit(1000))).scalars().all()
    return WaitlistPage(
        entries=[WaitlistEntryOut(
            id=r.id, product=r.product, email=r.email, name=r.name, company=r.company,
            user_id=r.user_id, created_at=r.created_at,
        ) for r in rows],
        total=len(rows),
    )
