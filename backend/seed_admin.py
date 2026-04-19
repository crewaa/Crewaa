"""
Seed script to create the initial admin user.

Usage:
    python seed_admin.py --email admin@crewaa.in --password YourSecurePassword123
"""

import asyncio
import argparse
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.modules.users.models import User

# Import all models so SQLAlchemy can resolve relationships
import app.models  # noqa: F401


async def seed_admin(email: str, password: str):
    async with AsyncSessionLocal() as db:
        # Check if admin already exists
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar()

        if existing:
            print(f"⚠️  User with email '{email}' already exists (role: {existing.role})")
            if existing.role != "ADMIN":
                existing.role = "ADMIN"
                existing.hashed_password = hash_password(password)
                await db.commit()
                print(f"✅ Updated existing user to ADMIN role")
            else:
                print(f"ℹ️  Already an admin — no changes made")
            return

        admin = User(
            email=email,
            hashed_password=hash_password(password),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        print(f"✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   ID: {admin.id}")
        print(f"   Role: {admin.role}")


def main():
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password")
    args = parser.parse_args()

    asyncio.run(seed_admin(args.email, args.password))


if __name__ == "__main__":
    main()
