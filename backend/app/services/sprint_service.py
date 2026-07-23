from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repository import sprint as sprint_repository
from app.models.space import Space
from app.models.sprint import Sprint
from app.models.user import User
from app.schemas.pydantic_models import SprintCreate, SprintResponse, SprintUpdate


def _get_space_or_404(db: Session, space_id: str) -> Space:
    space = sprint_repository.get_space(db, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    return space


def _get_sprint_or_404(db: Session, sprint_id: str) -> Sprint:
    sprint = sprint_repository.get_sprint(db, sprint_id)
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    return sprint


def _ensure_space_active(space: Space) -> None:
    if space.status_space == "Archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is archived")
    if space.status_space != "Active" or space.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space must be active")


def _can_view_space_sprints(db: Session, space: Space, user: User) -> bool:
    if user.role == "SUPER_ADMIN":
        return True
    if space.owner_id == user.user_id:
        return True
    return sprint_repository.get_active_space_member(db, space.space_id, user.user_id) is not None


def _ensure_can_view_space_sprints(db: Session, space: Space, user: User) -> None:
    if not _can_view_space_sprints(db, space, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _ensure_can_modify_space_sprints(db: Session, space: Space, user: User) -> None:
    if user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN cannot modify sprints",
        )
    _ensure_can_view_space_sprints(db, space, user)


def _ensure_sprint_not_deleted(sprint: Sprint) -> None:
    if sprint.status == "Deleted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sprint is deleted")


def _ensure_no_other_active_sprint(db: Session, sprint: Sprint) -> None:
    active_sprint = sprint_repository.get_active_sprint_by_space(db, sprint.space_id)
    if active_sprint and active_sprint.sprint_id != sprint.sprint_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete the active sprint before activating another sprint",
        )


def _serialize_sprints(sprints: Iterable[Sprint]) -> list[SprintResponse]:
    return [SprintResponse.model_validate(sprint) for sprint in sprints]


def _resolve_end_date(start_date: datetime | None, end_date: datetime | None, duration_weeks: int | None) -> datetime | None:
    if end_date is not None or start_date is None or duration_weeks is None:
        return end_date
    return start_date + timedelta(weeks=duration_weeks)


def _as_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def apply_sprint_automation(db: Session, space_id: str) -> None:
    """Apply persisted auto_start and auto_complete settings for a space."""
    now = datetime.utcnow()
    sprints = sprint_repository.list_sprint_records(
        db,
        space_id=space_id,
        include_deleted=False,
    )
    changed = False

    for sprint in sprints:
        if sprint.status != "Active" or not sprint.auto_complete:
            continue
        active_task_count = sprint_repository.count_active_tasks_by_sprint(db, sprint.sprint_id)
        incomplete_task_count = sprint_repository.count_incomplete_tasks_by_sprint(db, sprint.sprint_id)
        if active_task_count > 0 and incomplete_task_count == 0:
            sprint.status = "Completed"
            sprint.completed_at = now
            sprint.updated_at = now
            changed = True

    active_sprint = next((sprint for sprint in sprints if sprint.status == "Active"), None)
    if active_sprint is None:
        for index, sprint in enumerate(sprints):
            if sprint.status != "Planned" or not sprint.auto_start:
                continue
            start_date = _as_utc_naive(sprint.start_date)
            if start_date is None or start_date > now:
                continue
            previous_sprints_completed = all(previous.status == "Completed" for previous in sprints[:index])
            if not previous_sprints_completed:
                continue

            sprint.status = "Active"
            sprint.updated_at = now
            changed = True
            break

    if changed:
        db.commit()
        for sprint in sprints:
            db.refresh(sprint)


def list_sprints(
    db: Session,
    space_id: str,
    current_user: User,
    *,
    include_deleted: bool,
) -> list[SprintResponse]:
    space = _get_space_or_404(db, space_id)
    _ensure_can_view_space_sprints(db, space, current_user)
    apply_sprint_automation(db, space_id)

    sprints = sprint_repository.list_sprint_records(
        db,
        space_id=space_id,
        include_deleted=include_deleted,
    )
    return _serialize_sprints(sprints)


def get_sprint(db: Session, sprint_id: str, current_user: User) -> SprintResponse:
    sprint = _get_sprint_or_404(db, sprint_id)
    space = sprint.space or _get_space_or_404(db, sprint.space_id)
    _ensure_can_view_space_sprints(db, space, current_user)
    apply_sprint_automation(db, sprint.space_id)
    sprint = _get_sprint_or_404(db, sprint_id)
    return SprintResponse.model_validate(sprint)


def create_sprint(db: Session, space_id: str, payload: SprintCreate, current_user: User) -> SprintResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_sprints(db, space, current_user)

    duration_weeks = payload.duration_weeks or 2
    now = datetime.utcnow()
    sprint = Sprint(
        space_id=space_id,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=_resolve_end_date(payload.start_date, payload.end_date, duration_weeks),
        duration_weeks=duration_weeks,
        status=payload.status,
        auto_start=payload.auto_start,
        auto_complete=payload.auto_complete,
        created_at=now,
        updated_at=now,
    )
    if sprint.status == "Active":
        _ensure_no_other_active_sprint(db, sprint)
    sprint_repository.create_sprint_record(db, sprint)
    apply_sprint_automation(db, space_id)
    sprint = _get_sprint_or_404(db, sprint.sprint_id)
    return SprintResponse.model_validate(sprint)


def update_sprint(db: Session, sprint_id: str, payload: SprintUpdate, current_user: User) -> SprintResponse:
    sprint = _get_sprint_or_404(db, sprint_id)
    _ensure_sprint_not_deleted(sprint)

    space = sprint.space or _get_space_or_404(db, sprint.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_sprints(db, space, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    effective_start = update_data.get("start_date", sprint.start_date)
    effective_duration = update_data.get("duration_weeks", sprint.duration_weeks)
    if "end_date" not in update_data and "start_date" in update_data:
        update_data["end_date"] = _resolve_end_date(effective_start, None, effective_duration)

    effective_end = update_data.get("end_date", sprint.end_date)
    if effective_start and effective_end and effective_end <= effective_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date",
        )
    if update_data.get("status") == "Active":
        _ensure_no_other_active_sprint(db, sprint)

    for field, value in update_data.items():
        setattr(sprint, field, value)
    sprint.updated_at = datetime.utcnow()

    sprint_repository.save_sprint(db, sprint)
    apply_sprint_automation(db, sprint.space_id)
    sprint = _get_sprint_or_404(db, sprint_id)
    return SprintResponse.model_validate(sprint)


def delete_sprint(db: Session, sprint_id: str, current_user: User) -> SprintResponse:
    sprint = _get_sprint_or_404(db, sprint_id)
    _ensure_sprint_not_deleted(sprint)

    space = sprint.space or _get_space_or_404(db, sprint.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_sprints(db, space, current_user)

    active_task_count = sprint_repository.count_active_tasks_by_sprint(db, sprint_id)
    if active_task_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete sprint with active tasks",
        )

    sprint.status = "Deleted"
    sprint.updated_at = datetime.utcnow()
    sprint_repository.save_sprint(db, sprint)
    return SprintResponse.model_validate(sprint)


def activate_sprint(db: Session, sprint_id: str, current_user: User) -> SprintResponse:
    sprint = _get_sprint_or_404(db, sprint_id)
    _ensure_sprint_not_deleted(sprint)
    if sprint.status == "Completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Completed sprint cannot be activated")

    space = sprint.space or _get_space_or_404(db, sprint.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_sprints(db, space, current_user)
    _ensure_no_other_active_sprint(db, sprint)

    if sprint.status != "Active":
        sprint.status = "Active"
        sprint.updated_at = datetime.utcnow()
        sprint_repository.save_sprint(db, sprint)
    apply_sprint_automation(db, sprint.space_id)
    sprint = _get_sprint_or_404(db, sprint_id)
    return SprintResponse.model_validate(sprint)


def complete_sprint(db: Session, sprint_id: str, current_user: User) -> SprintResponse:
    sprint = _get_sprint_or_404(db, sprint_id)
    _ensure_sprint_not_deleted(sprint)
    if sprint.status == "Completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sprint is already completed")
    if sprint.status != "Active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active sprints can be completed")

    space = sprint.space or _get_space_or_404(db, sprint.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_sprints(db, space, current_user)

    incomplete_task_count = sprint_repository.count_incomplete_tasks_by_sprint(db, sprint_id)
    if incomplete_task_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint can only be completed when all tasks are done",
        )

    now = datetime.utcnow()
    sprint.status = "Completed"
    sprint.completed_at = now
    sprint.updated_at = now
    sprint_repository.save_sprint(db, sprint)
    apply_sprint_automation(db, sprint.space_id)
    sprint = _get_sprint_or_404(db, sprint_id)
    return SprintResponse.model_validate(sprint)
