from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from fastapi import HTTPException

from app.modules.users.models import User, CreatorProfile, BrandProfile
from app.core.security import hash_password
from app.modules.admin.schemas import (
    PlatformStats, AdminUserListItem, AdminUserDetail,
    PaginatedUsers,
)


async def get_platform_stats(db: AsyncSession) -> PlatformStats:
    """Aggregate counts by role."""
    total = await db.scalar(select(func.count(User.id)))
    creators = await db.scalar(
        select(func.count(User.id)).where(User.role == "INFLUENCER")
    )
    brands = await db.scalar(
        select(func.count(User.id)).where(User.role == "BRAND")
    )
    admins = await db.scalar(
        select(func.count(User.id)).where(User.role == "ADMIN")
    )

    return PlatformStats(
        total_users=total or 0,
        total_creators=creators or 0,
        total_brands=brands or 0,
        total_admins=admins or 0,
    )


async def list_users(
    db: AsyncSession,
    role_filter: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedUsers:
    """Paginated, filterable user list."""
    query = select(User)

    if role_filter:
        query = query.where(User.role == role_filter.upper())
    if search:
        query = query.where(
            or_(
                User.email.ilike(f"%{search}%"),
                User.id == int(search) if search.isdigit() else False,
            )
        )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(User.id.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    # Check profile existence for each user
    items = []
    for u in users:
        has_profile = False
        if u.role == "INFLUENCER":
            cp = await db.scalar(
                select(func.count(CreatorProfile.id)).where(CreatorProfile.user_id == u.id)
            )
            has_profile = (cp or 0) > 0
        elif u.role == "BRAND":
            bp = await db.scalar(
                select(func.count(BrandProfile.id)).where(BrandProfile.user_id == u.id)
            )
            has_profile = (bp or 0) > 0

        items.append(AdminUserListItem(
            id=u.id,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            has_profile=has_profile,
        ))

    return PaginatedUsers(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_user_detail(db: AsyncSession, user_id: int) -> AdminUserDetail:
    """Full user detail including profile data."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar()

    if not user:
        raise HTTPException(404, "User not found")

    detail = AdminUserDetail(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
    )

    if user.role == "INFLUENCER":
        cp_result = await db.execute(
            select(CreatorProfile).where(CreatorProfile.user_id == user_id)
        )
        cp = cp_result.scalar()
        if cp:
            detail.creator_full_name = cp.full_name
            detail.creator_location = cp.location
            detail.creator_category = cp.category
            detail.creator_primary_platform = cp.primary_platform
            detail.creator_instagram_username = cp.instagram_username
            detail.creator_youtube_username = cp.youtube_username
            detail.creator_bio = cp.bio
            detail.creator_profile_completed = cp.is_completed

    elif user.role == "BRAND":
        bp_result = await db.execute(
            select(BrandProfile).where(BrandProfile.user_id == user_id)
        )
        bp = bp_result.scalar()
        if bp:
            detail.brand_name = bp.brand_name
            detail.brand_industry = bp.industry
            detail.brand_description = bp.description
            detail.brand_website = bp.website
            detail.brand_campaign_goal = bp.campaign_goal
            detail.brand_budget_range = bp.budget_range
            detail.brand_profile_completed = bp.is_completed

    return detail


async def delete_user(db: AsyncSession, user_id: int) -> None:
    """Delete user and cascade all related data."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar()

    if not user:
        raise HTTPException(404, "User not found")

    if user.role == "ADMIN":
        raise HTTPException(400, "Cannot delete an admin user from the dashboard")

    await db.delete(user)
    await db.commit()


async def admin_create_user(
    db: AsyncSession,
    email: str,
    password: str,
    role: str,
) -> User:
    """Admin-initiated user creation (creators & brands only)."""
    if role.upper() not in ("BRAND", "INFLUENCER"):
        raise HTTPException(400, "Can only create BRAND or INFLUENCER users")

    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar():
        raise HTTPException(400, "User with this email already exists")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        role=role.upper(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
