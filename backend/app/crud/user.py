from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import get_password_hash


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email address."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Get a user by ID."""
    return db.query(User).filter(User.user_id == user_id).first()


def create_user(db: Session, email: str, full_name: str, password: str) -> User:
    """Create a new user with email, full name, and password."""
    user = User(
        email=email,
        full_name=full_name,
        password_hash=get_password_hash(password),
        status_user="Active",
        role="USER",
        is_verified=True,
        failed_login_attempts=0,
        avatar_url=None,
        locked_until=None,
        last_login=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_last_login(db: Session, user: User) -> User:
    """Update user's last login timestamp."""
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user
