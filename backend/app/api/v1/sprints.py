from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import SprintCreate, SprintResponse, SprintUpdate
from app.services import sprint_service


router = APIRouter(tags=["sprints"])


@router.get("/spaces/{space_id}/sprints", response_model=list[SprintResponse])
def list_sprints(
    space_id: str,
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SprintResponse]:
    return sprint_service.list_sprints(
        db,
        space_id,
        current_user,
        include_deleted=include_deleted,
    )


@router.post(
    "/spaces/{space_id}/sprints",
    response_model=SprintResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sprint(
    space_id: str,
    payload: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SprintResponse:
    return sprint_service.create_sprint(db, space_id, payload, current_user)


@router.get("/sprints/{sprint_id}", response_model=SprintResponse)
def get_sprint(
    sprint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SprintResponse:
    return sprint_service.get_sprint(db, sprint_id, current_user)


@router.patch("/sprints/{sprint_id}", response_model=SprintResponse)
def update_sprint(
    sprint_id: str,
    payload: SprintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SprintResponse:
    return sprint_service.update_sprint(db, sprint_id, payload, current_user)


@router.delete("/sprints/{sprint_id}", response_model=SprintResponse)
def delete_sprint(
    sprint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SprintResponse:
    return sprint_service.delete_sprint(db, sprint_id, current_user)


@router.post("/sprints/{sprint_id}/complete", response_model=SprintResponse)
def complete_sprint(
    sprint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SprintResponse:
    return sprint_service.complete_sprint(db, sprint_id, current_user)
