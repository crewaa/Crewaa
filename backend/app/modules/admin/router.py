from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.modules.users.models import User
from app.modules.admin.schemas import (
    PlatformStats, AdminUserDetail, AdminUserCreate, PaginatedUsers,
)
from app.modules.admin import service


router = APIRouter(prefix="/admin", tags=["Admin"])


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the current user is an ADMIN."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )
    return current_user


@router.get("/stats", response_model=PlatformStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Platform-wide statistics."""
    return await service.get_platform_stats(db)


@router.get("/users", response_model=PaginatedUsers)
async def list_users(
    role: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all users with pagination, filtering, and search."""
    return await service.list_users(db, role_filter=role, search=search, page=page, page_size=page_size)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Get detailed user info including profile."""
    return await service.get_user_detail(db, user_id)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a user and cascade all related data."""
    await service.delete_user(db, user_id)
    return {"detail": f"User {user_id} deleted successfully"}


@router.post("/users", response_model=AdminUserDetail)
async def create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new user (BRAND or INFLUENCER only)."""
    user = await service.admin_create_user(db, data.email, data.password, data.role)
    return await service.get_user_detail(db, user.id)
