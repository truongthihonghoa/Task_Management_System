from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_optional_bearer_token
from app.repository import space as space_repository
from app.db.session import get_db
from app.schemas.pydantic_models import (
    SpaceCreate,
    SpaceMemberResponse,
    SpaceResponse,
    SpaceUpdate,
)


router = APIRouter(
    prefix="/spaces",
    tags=["spaces"],
    dependencies=[Depends(get_optional_bearer_token)],
)


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(payload: SpaceCreate, db: Session = Depends(get_db)):
    return space_repository.create_space(db, payload)


@router.get("", response_model=List[SpaceResponse])
def list_spaces(
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return space_repository.list_spaces(db, include_deleted=include_deleted)


@router.get("/owners/{owner_id}/trash", response_model=List[SpaceResponse])
def list_owner_trash(owner_id: str, db: Session = Depends(get_db)):
    return space_repository.list_owner_trash(db, owner_id)


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(space_id: str, db: Session = Depends(get_db)):
    return space_repository.get_space(db, space_id)


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(space_id: str, payload: SpaceUpdate, db: Session = Depends(get_db)):
    return space_repository.update_space(db, space_id, payload)


@router.post("/{space_id}/archive", response_model=SpaceResponse)
def archive_space(space_id: str, db: Session = Depends(get_db)):
    return space_repository.archive_space(db, space_id)


@router.post("/{space_id}/restore", response_model=SpaceResponse)
def restore_space(space_id: str, db: Session = Depends(get_db)):
    return space_repository.restore_space(db, space_id)


@router.delete("/{space_id}", response_model=SpaceResponse)
def delete_space(space_id: str, db: Session = Depends(get_db)):
    return space_repository.delete_space(db, space_id)


@router.get("/{space_id}/members", response_model=List[SpaceMemberResponse])
def list_space_members(space_id: str, db: Session = Depends(get_db)):
    return space_repository.list_space_members(db, space_id)
