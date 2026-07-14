from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repository.repository import (
    create_assignment_history,
    create_task_assignee,
    delete_task_assignee,
    get_active_space_member,
    get_task_assignee,
    get_task_by_id,
    get_user_by_id,
    list_assignment_history,
    list_task_assignees,
)
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.task_assignment_history import TaskAssignmentHistory
from app.models.user import User
from app.schemas.pydantic_models import (
    AssignTaskAssigneesRequest,
    ReassignTaskAssigneeRequest,
    RemoveTaskAssigneeRequest,
)
from app.services.notification_service import NotificationService


class TaskAssignmentService:
    def __init__(self, notification_service: NotificationService | None = None) -> None:
        self.notification_service = notification_service or NotificationService()

    def get_task_assignees(self, db: Session, task_id: str, current_user: User) -> list[TaskAssignee]:
        task = self._get_active_task_or_404(db, task_id)
        self._ensure_can_view_task_assignments(db, task, current_user)
        return list_task_assignees(db, task_id)

    def get_assignment_history(
        self,
        db: Session,
        task_id: str,
        current_user: User,
    ) -> list[TaskAssignmentHistory]:
        task = self._get_active_task_or_404(db, task_id)
        self._ensure_can_view_task_assignments(db, task, current_user)
        return list_assignment_history(db, task_id)

    def assign_task_assignees(
        self,
        db: Session,
        task_id: str,
        payload: AssignTaskAssigneesRequest,
        current_user: User,
    ) -> list[TaskAssignee]:
        task = self._get_active_task_or_404(db, task_id)
        self._ensure_can_modify_task_assignments(db, task, current_user)

        for assignee_id in payload.assignee_ids:
            self._validate_assignable_user(db, task, assignee_id)
            if get_task_assignee(db, task_id, assignee_id) is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"User already assigned: {assignee_id}",
                )

        now = datetime.utcnow()
        try:
            for assignee_id in payload.assignee_ids:
                create_task_assignee(db, task_id, assignee_id)
                create_assignment_history(
                    db,
                    task_id=task_id,
                    previous_assignee_id=None,
                    new_assignee_id=assignee_id,
                    changed_by=current_user.user_id,
                    reason=payload.reason,
                    change_status=task.task_status,
                    changed_at=now,
                )
                self.notification_service.create_notification(
                    db,
                    user_id=assignee_id,
                    actor_id=current_user.user_id,
                    task_id=task.task_id,
                    space_id=task.space_id,
                    notification_type="task_assigned",
                    title="New task assigned",
                    message=f"{current_user.full_name} assigned you to {task.title}.",
                    audience="USER",
                    metadata={
                        "task_title": task.title,
                        "space_name": task.space.name_space if task.space else None,
                    },
                )
            db.commit()
        except Exception:
            db.rollback()
            raise

        return list_task_assignees(db, task_id)

    def reassign_task_assignee(
        self,
        db: Session,
        task_id: str,
        payload: ReassignTaskAssigneeRequest,
        current_user: User,
    ) -> list[TaskAssignee]:
        task = self._get_active_task_or_404(db, task_id)
        self._ensure_can_modify_task_assignments(db, task, current_user)

        current_assignment = get_task_assignee(db, task_id, payload.previous_assignee_id)
        if current_assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Previous assignee not found.")

        if payload.new_assignee_id is not None:
            self._validate_assignable_user(db, task, payload.new_assignee_id)
            existing_assignment = get_task_assignee(db, task_id, payload.new_assignee_id)
            if existing_assignment is not None and payload.new_assignee_id != payload.previous_assignee_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"User already assigned: {payload.new_assignee_id}",
                )
            if payload.new_assignee_id == payload.previous_assignee_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="New assignee must be different from previous assignee.",
                )

        now = datetime.utcnow()
        try:
            if payload.new_assignee_id is None:
                delete_task_assignee(db, current_assignment)
                self._notify_assignee_removed(db, task, current_user, payload.previous_assignee_id)
            else:
                current_assignment.assignee_id = payload.new_assignee_id
                self.notification_service.create_notification(
                    db,
                    user_id=payload.new_assignee_id,
                    actor_id=current_user.user_id,
                    task_id=task.task_id,
                    space_id=task.space_id,
                    notification_type="task_assigned",
                    title="New task assigned",
                    message=f"{current_user.full_name} assigned you to {task.title}.",
                    audience="USER",
                    metadata={
                        "task_title": task.title,
                        "space_name": task.space.name_space if task.space else None,
                        "previous_assignee_id": payload.previous_assignee_id,
                    },
                )
                self.notification_service.create_notification(
                    db,
                    user_id=payload.previous_assignee_id,
                    actor_id=current_user.user_id,
                    task_id=task.task_id,
                    space_id=task.space_id,
                    notification_type="task_updated",
                    title="Task assignment updated",
                    message=f"{current_user.full_name} reassigned {task.title}.",
                    audience="USER",
                    metadata={
                        "event": "assignee_replaced",
                        "task_title": task.title,
                        "new_assignee_id": payload.new_assignee_id,
                    },
                )

            create_assignment_history(
                db,
                task_id=task_id,
                previous_assignee_id=payload.previous_assignee_id,
                new_assignee_id=payload.new_assignee_id,
                changed_by=current_user.user_id,
                reason=payload.reason,
                change_status=task.task_status,
                changed_at=now,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise

        return list_task_assignees(db, task_id)

    def remove_task_assignee(
        self,
        db: Session,
        task_id: str,
        assignee_id: str,
        payload: RemoveTaskAssigneeRequest | None,
        current_user: User,
    ) -> None:
        task = self._get_active_task_or_404(db, task_id)
        self._ensure_can_modify_task_assignments(db, task, current_user)

        current_assignment = get_task_assignee(db, task_id, assignee_id)
        if current_assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Previous assignee not found.")

        now = datetime.utcnow()
        try:
            delete_task_assignee(db, current_assignment)
            create_assignment_history(
                db,
                task_id=task_id,
                previous_assignee_id=assignee_id,
                new_assignee_id=None,
                changed_by=current_user.user_id,
                reason=payload.reason if payload else None,
                change_status=task.task_status,
                changed_at=now,
            )
            self._notify_assignee_removed(db, task, current_user, assignee_id)
            db.commit()
        except Exception:
            db.rollback()
            raise

    def _get_active_task_or_404(self, db: Session, task_id: str) -> Task:
        task = get_task_by_id(db, task_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
        if task.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task deleted.")
        return task

    def _is_space_owner(self, task: Task, user: User) -> bool:
        return task.space is not None and task.space.owner_id == user.user_id

    def _is_active_space_member(self, db: Session, task: Task, user_id: str) -> bool:
        return get_active_space_member(db, task.space_id, user_id) is not None

    def _ensure_can_view_task_assignments(self, db: Session, task: Task, current_user: User) -> None:
        if current_user.role == "SUPER_ADMIN":
            return
        if self._is_space_owner(task, current_user):
            return
        if self._is_active_space_member(db, task, current_user.user_id):
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    def _ensure_can_modify_task_assignments(self, db: Session, task: Task, current_user: User) -> None:
        if current_user.role == "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN cannot modify task assignments.",
            )
        self._ensure_can_view_task_assignments(db, task, current_user)

    def _validate_assignable_user(self, db: Session, task: Task, user_id: str) -> User:
        user = get_user_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User not found: {user_id}")
        if user.status_user != "Active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User is inactive: {user_id}")
        if user.locked_until is not None and user.locked_until > datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User is locked: {user_id}")
        if not self._is_active_space_member(db, task, user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User is not an active member of the task space: {user_id}",
            )
        return user

    def _notify_assignee_removed(
        self,
        db: Session,
        task: Task,
        current_user: User,
        assignee_id: str,
    ) -> None:
        self.notification_service.create_notification(
            db,
            user_id=assignee_id,
            actor_id=current_user.user_id,
            task_id=task.task_id,
            space_id=task.space_id,
            notification_type="task_updated",
            title="Task assignment updated",
            message=f"{current_user.full_name} removed you from {task.title}.",
            audience="USER",
            metadata={
                "event": "assignee_removed",
                "task_title": task.title,
                "space_name": task.space.name_space if task.space else None,
            },
        )
