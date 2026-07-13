from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repository import space as space_repository
from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.user import User
from app.schemas.pydantic_models import (
    SpaceCreate,
    SpaceMemberCreate,
    SpaceMemberResponse,
    SpaceMemberUpdate,
    SpaceResponse,
    SpaceUpdate,
    UserSummaryResponse,
)


TRASH_RETENTION_DAYS = 14


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


def _ensure_active_space(space: Space) -> None:
    if space.status_space != "Active" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space must be active",
        )


def _ensure_can_manage_members(space: Space, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if space.owner_id == current_user.user_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permission denied",
    )


def _ensure_space_name_available(
    db: Session,
    *,
    owner_id: str,
    name_space: str,
    exclude_space_id: str | None = None,
) -> None:
    existing_space = space_repository.find_space_by_owner_and_name(
        db,
        owner_id=owner_id,
        name_space=name_space,
        exclude_space_id=exclude_space_id,
    )
    if existing_space:
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
        user=UserSummaryResponse.model_validate(member.user) if member.user else None,
    )


def get_space_or_404(db: Session, space_id: str) -> Space:
    space = space_repository.get_space(db, space_id)
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found",
        )
    return space


def create_space(db: Session, payload: SpaceCreate) -> SpaceResponse:
    owner = space_repository.get_user(db, payload.owner_id)
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
    member = SpaceMember(
        user_id=payload.owner_id,
        role="OWNER",
        status="Active",
    )
    space_repository.create_space_with_owner_member(db, space, member)
    return _space_response(space)


def list_spaces(db: Session, include_deleted: bool = False) -> List[SpaceResponse]:
    spaces = space_repository.list_space_records(db, include_deleted=include_deleted)
    return [_space_response(space) for space in spaces]


def list_owner_trash(db: Session, owner_id: str) -> List[SpaceResponse]:
    owner = space_repository.get_user(db, owner_id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )

    trash_cutoff = datetime.utcnow() - timedelta(days=TRASH_RETENTION_DAYS)
    spaces = space_repository.list_owner_trash_records(
        db,
        owner_id=owner_id,
        trash_cutoff=trash_cutoff,
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
    space_repository.save_space(db, space)
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
    space_repository.save_space(db, space)
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
    owner = space_repository.get_user(db, space.owner_id)
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
    space_repository.save_space(db, space)
    return _space_response(space)


def delete_space(db: Session, space_id: str) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    now = datetime.utcnow()
    space.status_space = "Deleted"
    space.deleted_at = now
    space.updated_at = now
    space_repository.save_space(db, space)
    return _space_response(space)


def list_space_members(db: Session, space_id: str) -> List[SpaceMemberResponse]:
    space = get_space_or_404(db, space_id)
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is deleted",
        )

    members = space_repository.list_space_member_records(db, space_id)
    return [_space_member_response(member) for member in members]


def add_space_member(
    db: Session,
    space_id: str,
    payload: SpaceMemberCreate,
    current_user: User,
) -> SpaceMemberResponse:
    space = get_space_or_404(db, space_id)
    _ensure_active_space(space)
    _ensure_can_manage_members(space, current_user)

    user = space_repository.get_user(db, payload.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if user.status_user != "Active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not active",
        )

    existing_member = space_repository.get_space_member(db, space_id, payload.user_id)
    if existing_member and existing_member.status == "Active" and existing_member.removed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already an active member",
        )

    now = datetime.utcnow()
    if existing_member:
        existing_member.role = "OWNER" if space.owner_id == payload.user_id else payload.role
        existing_member.status = "Active"
        existing_member.removed_at = None
        existing_member.joined_at = now
        space_repository.save_space_member(db, existing_member)
        existing_member.user = user
        return _space_member_response(existing_member)

    member = SpaceMember(
        space_id=space_id,
        user_id=payload.user_id,
        role="OWNER" if space.owner_id == payload.user_id else payload.role,
        status="Active",
        joined_at=now,
    )
    space_repository.create_space_member(db, member)
    member.user = user
    return _space_member_response(member)


def remove_space_member(
    db: Session,
    space_id: str,
    user_id: str,
    current_user: User,
) -> SpaceMemberResponse:
    space = get_space_or_404(db, space_id)
    _ensure_active_space(space)
    _ensure_can_manage_members(space, current_user)

    if user_id == space.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the space owner",
        )

    member = space_repository.get_active_space_member(db, space_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active space member not found",
        )

    member.status = "Removed"
    member.removed_at = datetime.utcnow()
    space_repository.save_space_member(db, member)
    return _space_member_response(member)


def update_space_member(
    db: Session,
    space_id: str,
    user_id: str,
    payload: SpaceMemberUpdate,
    current_user: User,
) -> SpaceMemberResponse:
    space = get_space_or_404(db, space_id)
    _ensure_active_space(space)
    _ensure_can_manage_members(space, current_user)

    member = space_repository.get_active_space_member(db, space_id, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active space member not found",
        )

    if user_id == space.owner_id and payload.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change the space owner's role",
        )
    if payload.role == "OWNER" and user_id != space.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot promote a member to owner from this endpoint",
        )

    member.role = payload.role
    space_repository.save_space_member(db, member)
    return _space_member_response(member)
