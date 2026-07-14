"""Database operations and rules for spaces."""
"""
space_repository.py — Database operations and space business logic.

Moved from crud/space.py as part of the crud → repository rename.
"""

from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.user import User
from app.services.notification_service import NotificationService

from app.schemas.pydantic_models import (
    SpaceCreate,
    SpaceMemberResponse,
    SpaceResponse,
    SpaceUpdate,
)


TRASH_RETENTION_DAYS = 14
notification_service = NotificationService()


def _trash_expires_at(space: Space) -> datetime | None:
    if not space.deleted_at:
        return None
    return space.deleted_at + timedelta(days=TRASH_RETENTION_DAYS)


def _is_trash_expired(space: Space, now: datetime | None = None) -> bool:
    expires_at = _trash_expires_at(space)
    if not expires_at:
        return False
    return expires_at <= (now or datetime.utcnow())


def _normalize_space_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space name is required",
        )
    return normalized


def _ensure_active_owner(owner: User) -> None:
    if owner.status_user != "Active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner is not active",
        )


def _is_active_space_member(db: Session, space_id: str, user_id: str) -> bool:
    return (
        db.query(SpaceMember)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .first()
        is not None
    )


def _can_view_space(db: Session, space: Space, current_user: User) -> bool:
    if current_user.role == "SUPER_ADMIN":
        return True
    if space.owner_id == current_user.user_id:
        return True
    return _is_active_space_member(db, space.space_id, current_user.user_id)


def _ensure_can_view_space(db: Session, space: Space, current_user: User) -> None:
    if not _can_view_space(db, space, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )


def _ensure_space_owner(space: Space, current_user: User) -> None:
    if space.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the space owner can perform this action",
        )


def _ensure_space_mutable(space: Space) -> None:
    if space.status_space == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is archived",
        )
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is deleted",
        )


def _ensure_space_name_available(
    db: Session,
    *,
    owner_id: str,
    name_space: str,
    exclude_space_id: str | None = None,
) -> None:
    query = db.query(Space).filter(
        Space.owner_id == owner_id,
        Space.status_space != "Deleted",
        Space.deleted_at.is_(None),
        func.lower(func.trim(Space.name_space)) == name_space.lower(),
    )
    if exclude_space_id:
        query = query.filter(Space.space_id != exclude_space_id)

    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Space name already exists",
        )


def _space_response(space: Space) -> SpaceResponse:
    return SpaceResponse(
        space_id=space.space_id,
        name_space=space.name_space,
        description=space.description,
        owner_id=space.owner_id,
        status_space=space.status_space,
        created_at=space.created_at,
        updated_at=space.updated_at,
        deleted_at=space.deleted_at,
    )


def _space_member_response(member: SpaceMember) -> SpaceMemberResponse:
    return SpaceMemberResponse(
        space_member_id=member.space_member_id,
        space_id=member.space_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        status=member.status,
        removed_at=member.removed_at,
    )


def get_space_or_404(db: Session, space_id: str) -> Space:
    space = db.query(Space).filter(Space.space_id == space_id).first()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found",
        )
    return space


def create_space(db: Session, payload: SpaceCreate) -> SpaceResponse:
    owner = db.query(User).filter(User.user_id == payload.owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )
    _ensure_active_owner(owner)

    name_space = _normalize_space_name(payload.name_space)
    _ensure_space_name_available(
        db,
        owner_id=payload.owner_id,
        name_space=name_space,
    )

    space = Space(
        name_space=name_space,
        description=payload.description,
        owner_id=payload.owner_id,
        status_space="Active",
    )
    db.add(space)
    db.flush()

    db.add(
        SpaceMember(
            space_id=space.space_id,
            user_id=payload.owner_id,
            role="OWNER",
            status="Active",
        )
    )
    notification_service.create_notification(
        db,
        user_id=payload.owner_id,
        notification_type="space_created",
        title="Space created",
        message=f"Space {space.name_space} was created.",
        space_id=space.space_id,
        audience="USER",
        metadata={"space_name": space.name_space},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space)


def list_spaces(db: Session, include_deleted: bool = False, current_user: User | None = None) -> List[SpaceResponse]:
    query = db.query(Space).order_by(Space.created_at.desc())
    if not include_deleted:
        query = query.filter(Space.deleted_at.is_(None), Space.status_space != "Deleted")
    if current_user is not None and current_user.role != "SUPER_ADMIN":
        query = (
            query.outerjoin(
                SpaceMember,
                (SpaceMember.space_id == Space.space_id)
                & (SpaceMember.user_id == current_user.user_id)
                & (SpaceMember.status == "Active")
                & (SpaceMember.removed_at.is_(None)),
            )
            .filter((Space.owner_id == current_user.user_id) | (SpaceMember.space_member_id.isnot(None)))
            .distinct()
        )
    return [_space_response(space) for space in query.all()]


def list_owner_trash(db: Session, owner_id: str, current_user: User | None = None) -> List[SpaceResponse]:
    if current_user is not None and current_user.role != "SUPER_ADMIN" and owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )

    owner = db.query(User).filter(User.user_id == owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )

    trash_cutoff = datetime.utcnow() - timedelta(days=TRASH_RETENTION_DAYS)
    spaces = (
        db.query(Space)
        .filter(
            Space.owner_id == owner_id,
            Space.status_space == "Deleted",
            Space.deleted_at.isnot(None),
            Space.deleted_at > trash_cutoff,
        )
        .order_by(Space.deleted_at.desc())
        .all()
    )
    return [_space_response(space) for space in spaces]


def get_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_can_view_space(db, space, current_user)
    return _space_response(space)


def update_space(db: Session, space_id: str, payload: SpaceUpdate, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    _ensure_space_mutable(space)

    if hasattr(payload, "model_dump"):
        update_data = payload.model_dump(exclude_unset=True)
    else:
        update_data = payload.dict(exclude_unset=True)

    if "name_space" in update_data:
        update_data["name_space"] = _normalize_space_name(update_data["name_space"])
        _ensure_space_name_available(
            db,
            owner_id=space.owner_id,
            name_space=update_data["name_space"],
            exclude_space_id=space.space_id,
        )

    for field, value in update_data.items():
        setattr(space, field, value)

    space.updated_at = datetime.utcnow()
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="space_updated",
        title="Space updated",
        message=f"Space {space.name_space} was updated.",
        space_id=space.space_id,
        audience="USER",
        metadata={"space_name": space.name_space, "updated_fields": sorted(update_data)},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space)


def archive_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    if space.status_space == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is already archived",
        )
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot archive deleted space",
        )

    space.status_space = "Archived"
    space.updated_at = datetime.utcnow()
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space archived",
        message=f"Space {space.name_space} was archived.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_archived"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space)


def restore_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    if space.status_space != "Deleted" or space.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is not deleted",
        )
    if _is_trash_expired(space):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space restore period has expired",
        )
    owner = db.query(User).filter(User.user_id == space.owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )
    _ensure_active_owner(owner)
    _ensure_space_name_available(
        db,
        owner_id=space.owner_id,
        name_space=space.name_space,
        exclude_space_id=space.space_id,
    )

    space.status_space = "Active"
    space.deleted_at = None
    space.updated_at = datetime.utcnow()
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space restored",
        message=f"Space {space.name_space} was restored.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_restored"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space)


def delete_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    _ensure_space_mutable(space)
    now = datetime.utcnow()
    space.status_space = "Deleted"
    space.deleted_at = now
    space.updated_at = now
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space deleted",
        message=f"Space {space.name_space} was moved to trash.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_deleted"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space)


def list_space_members(db: Session, space_id: str, current_user: User | None = None) -> List[SpaceMemberResponse]:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_can_view_space(db, space, current_user)
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is deleted",
        )

    members = (
        db.query(SpaceMember)
        .filter(SpaceMember.space_id == space_id)
        .order_by(SpaceMember.joined_at.asc())
        .all()
    )
    return [_space_member_response(member) for member in members]
