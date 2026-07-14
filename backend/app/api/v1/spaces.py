"""Space API endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_bearer_token
from app.repository import space as space_crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import (
    SpaceCreate,
    SpaceMemberCreate,
    SpaceMemberResponse,
    SpaceMemberUpdate,
    SpaceResponse,
    SpaceUpdate,
)
from app.services import space_service


def _ensure_can_create_space(payload: SpaceCreate, current_user: User) -> None:
    if current_user.role != "USER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users can create spaces",
        )
    if payload.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Users can only create spaces for themselves",
        )


router = APIRouter(
    prefix="/spaces",
    tags=["spaces"],
)


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(
    payload: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_can_create_space(payload, current_user)
    return space_crud.create_space(db, payload)


@router.get("", response_model=List[SpaceResponse])
def list_spaces(
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_spaces(db, include_deleted=include_deleted, current_user=current_user)


@router.get("/owners/{owner_id}/trash", response_model=List[SpaceResponse])
def list_owner_trash(
    owner_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_owner_trash(db, owner_id, current_user=current_user)


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.get_space(db, space_id, current_user=current_user)


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    space_id: str,
    payload: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.update_space(db, space_id, payload, current_user=current_user)


@router.post("/{space_id}/archive", response_model=SpaceResponse)
def archive_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.archive_space(db, space_id, current_user=current_user)


@router.post("/{space_id}/restore", response_model=SpaceResponse)
def restore_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.restore_space(db, space_id, current_user=current_user)


@router.delete("/{space_id}", response_model=SpaceResponse)
def delete_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.delete_space(db, space_id, current_user=current_user)


@router.get("/{space_id}/members", response_model=List[SpaceMemberResponse])
def list_space_members(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_space_members(db, space_id, current_user=current_user)
