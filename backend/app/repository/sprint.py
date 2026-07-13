from sqlalchemy.orm import Session

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.sprint import Sprint
from app.models.task import Task


def get_space(db: Session, space_id: str) -> Space | None:
    return db.query(Space).filter(Space.space_id == space_id).first()


def get_sprint(db: Session, sprint_id: str) -> Sprint | None:
    return db.query(Sprint).filter(Sprint.sprint_id == sprint_id).first()


def get_active_space_member(db: Session, space_id: str, user_id: str) -> SpaceMember | None:
    return (
        db.query(SpaceMember)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .first()
    )


def list_sprint_records(db: Session, *, space_id: str, include_deleted: bool) -> list[Sprint]:
    query = db.query(Sprint).filter(Sprint.space_id == space_id)
    if not include_deleted:
        query = query.filter(Sprint.status != "Deleted")
    return query.order_by(Sprint.created_at.asc(), Sprint.sprint_id.asc()).all()


def create_sprint_record(db: Session, sprint: Sprint) -> Sprint:
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return sprint


def save_sprint(db: Session, sprint: Sprint) -> Sprint:
    db.commit()
    db.refresh(sprint)
    return sprint


def count_active_tasks_by_sprint(db: Session, sprint_id: str) -> int:
    return (
        db.query(Task)
        .filter(
            Task.sprint_id == sprint_id,
            Task.deleted_at.is_(None),
        )
        .count()
    )
