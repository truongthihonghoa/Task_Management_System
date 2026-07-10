"""Database operations and rules for spaces."""
from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.user import User
from app.schemas.pydantic_models import (
    SpaceCreate,
    SpaceMemberResponse,
    SpaceResponse,
    SpaceUpdate,
)
from app.services.notification_service import NotificationService


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


def list_spaces(db: Session, include_deleted: bool = False) -> List[SpaceResponse]:
    query = db.query(Space).order_by(Space.created_at.desc())
    if not include_deleted:
        query = query.filter(Space.deleted_at.is_(None), Space.status_space != "Deleted")
    return [_space_response(space) for space in query.all()]


def list_owner_trash(db: Session, owner_id: str) -> List[SpaceResponse]:
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


def get_space(db: Session, space_id: str) -> SpaceResponse:
    return _space_response(get_space_or_404(db, space_id))


def update_space(db: Session, space_id: str, payload: SpaceUpdate) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update deleted space",
        )

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


def archive_space(db: Session, space_id: str) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
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


def restore_space(db: Session, space_id: str) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
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


def delete_space(db: Session, space_id: str) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
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


def list_space_members(db: Session, space_id: str) -> List[SpaceMemberResponse]:
    space = get_space_or_404(db, space_id)
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
