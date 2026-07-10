import logging
from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.notification_constants import (
    NotificationAudience,
    NotificationPreferenceScope,
    NotificationType,
    OWNER_LEVEL_TYPES,
    SUPER_ADMIN_TYPES,
    TASK_ACTIVITY_TYPES,
    VALID_AUDIENCES,
    VALID_NOTIFICATION_TYPES,
    default_preference_values,
    preference_scope_for_type,
)
from app.repository import notification as notification_repository
from app.repository import notification_preference as preference_repository
from app.models.notification import Notification
from app.models.space import Space
from app.models.task import Task
from app.models.user import User
from app.services.notification_preference_service import NotificationPreferenceService

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self) -> None:
        self.preference_service = NotificationPreferenceService()

    def _get_or_create_preference(self, db: Session, *, user_id: str, scope: str):
        preference = preference_repository.get_preference(db, user_id=user_id, scope=scope)
        if preference is not None:
            return preference
        return self.preference_service.ensure_preference(db, user_id=user_id, scope=scope)

    def _can_create_for_recipient(
        self,
        db: Session,
        *,
        recipient: User,
        notification_type: str,
        space_id: str | None,
    ) -> bool:
        scope = preference_scope_for_type(notification_type)
        if scope == NotificationPreferenceScope.SUPER_ADMIN.value and recipient.role != "SUPER_ADMIN":
            logger.info("notification skipped because recipient is not super admin", extra={"recipient_id": recipient.user_id})
            return False
        if recipient.role == "SUPER_ADMIN" and notification_type in TASK_ACTIVITY_TYPES:
            logger.info("task notification skipped for super admin", extra={"recipient_id": recipient.user_id})
            return False
        if notification_type in OWNER_LEVEL_TYPES:
            if not space_id:
                logger.info("owner notification skipped because space_id is missing", extra={"recipient_id": recipient.user_id})
                return False
            space = db.get(Space, space_id)
            if space is None or space.owner_id != recipient.user_id:
                logger.info(
                    "owner notification skipped because recipient is not owner",
                    extra={"recipient_id": recipient.user_id, "space_id": space_id},
                )
                return False

        preference = self._get_or_create_preference(db, user_id=recipient.user_id, scope=scope)
        defaults = default_preference_values(scope)["app_settings"]
        app_settings = {**defaults, **(preference.app_settings or {})}
        if app_settings.get(notification_type, defaults.get(notification_type, True)) is False:
            logger.info(
                "notification skipped by app preference",
                extra={"notification_type": notification_type, "recipient_id": recipient.user_id},
            )
            return False
        return True

    def create_notification(
        self,
        db: Session,
        *,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        actor_id: str | None = None,
        task_id: str | None = None,
        space_id: str | None = None,
        audience: str = NotificationAudience.USER.value,
        metadata: dict[str, Any] | None = None,
        allow_self_notification: bool = False,
    ) -> Notification | None:
        if notification_type not in VALID_NOTIFICATION_TYPES:
            raise ValueError(f"Invalid notification type: {notification_type}")
        if audience not in VALID_AUDIENCES:
            raise ValueError(f"Invalid notification audience: {audience}")
        if actor_id == user_id and not allow_self_notification:
            logger.info(
                "notification skipped due to self-notification",
                extra={"notification_type": notification_type, "recipient_id": user_id, "actor_id": actor_id},
            )
            return None

        recipient = db.get(User, user_id)
        if recipient is None:
            logger.info("notification skipped because recipient does not exist", extra={"recipient_id": user_id})
            return None
        if actor_id is not None and db.get(User, actor_id) is None:
            logger.info("notification skipped because actor does not exist", extra={"actor_id": actor_id})
            return None
        if task_id is not None and db.get(Task, task_id) is None:
            logger.info("notification skipped because task does not exist", extra={"task_id": task_id})
            return None
        if space_id is not None and db.get(Space, space_id) is None:
            logger.info("notification skipped because space does not exist", extra={"space_id": space_id})
            return None
        if notification_type in SUPER_ADMIN_TYPES and audience != NotificationAudience.SUPER_ADMIN.value:
            audience = NotificationAudience.SUPER_ADMIN.value
        if notification_type in OWNER_LEVEL_TYPES and audience != NotificationAudience.OWNER.value:
            audience = NotificationAudience.OWNER.value

        if not self._can_create_for_recipient(
            db,
            recipient=recipient,
            notification_type=notification_type,
            space_id=space_id,
        ):
            return None

        notification = notification_repository.create_notification(
            db,
            user_id=user_id,
            actor_id=actor_id,
            task_id=task_id,
            space_id=space_id,
            type=notification_type,
            title=title,
            message=message,
            audience=audience,
            metadata_=metadata,
            is_read=False,
            read_at=None,
        )
        logger.info(
            "notification created",
            extra={
                "notification_type": notification_type,
                "recipient_id": user_id,
                "actor_id": actor_id,
                "task_id": task_id,
                "space_id": space_id,
            },
        )
        return notification

    def create_notifications_for_users(
        self,
        db: Session,
        *,
        user_ids: Iterable[str],
        notification_type: str,
        title: str,
        message: str,
        actor_id: str | None = None,
        task_id: str | None = None,
        space_id: str | None = None,
        audience: str = NotificationAudience.USER.value,
        metadata: dict[str, Any] | None = None,
        allow_self_notification: bool = False,
    ) -> list[Notification]:
        if notification_type not in VALID_NOTIFICATION_TYPES:
            raise ValueError(f"Invalid notification type: {notification_type}")
        if audience not in VALID_AUDIENCES:
            raise ValueError(f"Invalid notification audience: {audience}")

        recipient_ids = list(dict.fromkeys(user_ids))
        if actor_id is not None and not allow_self_notification:
            recipient_ids = [user_id for user_id in recipient_ids if user_id != actor_id]
        if not recipient_ids:
            return []

        if actor_id is not None and db.get(User, actor_id) is None:
            logger.info("bulk notification skipped because actor does not exist", extra={"actor_id": actor_id})
            return []
        if task_id is not None and db.get(Task, task_id) is None:
            logger.info("bulk notification skipped because task does not exist", extra={"task_id": task_id})
            return []

        space = db.get(Space, space_id) if space_id is not None else None
        if space_id is not None and space is None:
            logger.info("bulk notification skipped because space does not exist", extra={"space_id": space_id})
            return []
        if notification_type in OWNER_LEVEL_TYPES and space is None:
            logger.info("bulk owner notification skipped because space_id is missing")
            return []
        if notification_type in SUPER_ADMIN_TYPES:
            audience = NotificationAudience.SUPER_ADMIN.value
        if notification_type in OWNER_LEVEL_TYPES:
            audience = NotificationAudience.OWNER.value

        recipients = list(
            db.execute(select(User).where(User.user_id.in_(recipient_ids))).scalars()
        )
        recipient_by_id = {recipient.user_id: recipient for recipient in recipients}
        scope = preference_scope_for_type(notification_type)
        preferences = {
            preference.user_id: preference
            for preference in preference_repository.list_preferences_for_users(
                db,
                user_ids=list(recipient_by_id),
                scope=scope,
            )
        }
        defaults = default_preference_values(scope)["app_settings"]

        created = []
        for user_id in recipient_ids:
            recipient = recipient_by_id.get(user_id)
            if recipient is None:
                continue
            if scope == NotificationPreferenceScope.SUPER_ADMIN.value and recipient.role != "SUPER_ADMIN":
                continue
            if recipient.role == "SUPER_ADMIN" and notification_type in TASK_ACTIVITY_TYPES:
                continue
            if notification_type in OWNER_LEVEL_TYPES and (space is None or space.owner_id != recipient.user_id):
                continue

            preference = preferences.get(user_id)
            app_settings = {**defaults, **((preference.app_settings if preference else None) or {})}
            if app_settings.get(notification_type, defaults.get(notification_type, True)) is False:
                continue

            notification = notification_repository.create_notification(
                db,
                user_id=user_id,
                actor_id=actor_id,
                task_id=task_id,
                space_id=space_id,
                type=notification_type,
                title=title,
                message=message,
                audience=audience,
                metadata_=metadata,
                is_read=False,
                read_at=None,
            )
            created.append(notification)
        logger.info("bulk notification count", extra={"created_count": len(created)})
        return created

    def create_notifications_for_role(
        self,
        db: Session,
        *,
        role: str,
        notification_type: str,
        title: str,
        message: str,
        actor_id: str | None = None,
        task_id: str | None = None,
        space_id: str | None = None,
        audience: str = NotificationAudience.USER.value,
        metadata: dict[str, Any] | None = None,
        allow_self_notification: bool = False,
    ) -> list[Notification]:
        recipients = list(db.execute(select(User.user_id).where(User.role == role, User.status_user == "Active")).scalars())
        return self.create_notifications_for_users(
            db,
            user_ids=recipients,
            notification_type=notification_type,
            title=title,
            message=message,
            actor_id=actor_id,
            task_id=task_id,
            space_id=space_id,
            audience=audience,
            metadata=metadata,
            allow_self_notification=allow_self_notification,
        )

    def create_super_admin_notification(
        self,
        db: Session,
        *,
        notification_type: str,
        title: str,
        message: str,
        actor_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        allow_self_notification: bool = False,
    ) -> list[Notification]:
        return self.create_notifications_for_role(
            db,
            role="SUPER_ADMIN",
            notification_type=notification_type,
            title=title,
            message=message,
            actor_id=actor_id,
            audience=NotificationAudience.SUPER_ADMIN.value,
            metadata=metadata,
            allow_self_notification=allow_self_notification,
        )

    def mark_read(self, db: Session, *, user_id: str, notification_id: str) -> Notification | None:
        return notification_repository.mark_notification_read_state(
            db,
            notification_id=notification_id,
            user_id=user_id,
            is_read=True,
            read_at=datetime.utcnow(),
        )

    def mark_unread(self, db: Session, *, user_id: str, notification_id: str) -> Notification | None:
        return notification_repository.mark_notification_read_state(
            db,
            notification_id=notification_id,
            user_id=user_id,
            is_read=False,
            read_at=None,
        )
