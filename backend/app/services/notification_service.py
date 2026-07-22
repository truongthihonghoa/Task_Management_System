import logging
from types import SimpleNamespace
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.email import send_notification_email
from app.core.notification_constants import (
    NotificationEmailFrequency,
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

    def _can_notify_recipient(
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
        return True

    def _app_enabled_for_notification(self, preference, *, notification_type: str, scope: str) -> bool:
        defaults = default_preference_values(scope)["app_settings"]
        app_settings = {**defaults, **(preference.app_settings or {})}
        if app_settings.get(notification_type, defaults.get(notification_type, True)) is False:
            logger.info(
                "notification skipped by app preference",
                extra={"notification_type": notification_type, "recipient_id": preference.user_id},
            )
            return False
        return True

    def _email_enabled_for_notification(self, preference, *, notification_type: str, scope: str) -> bool:
        if preference.email_enabled is not True:
            return False
        if preference.email_frequency != NotificationEmailFrequency.INSTANT.value:
            return False

        defaults = default_preference_values(scope)["email_settings"]
        email_settings = {**defaults, **(preference.email_settings or {})}
        return email_settings.get(notification_type, defaults.get(notification_type, True)) is True

    def _send_email_if_enabled(
        self,
        *,
        recipient: User,
        preference,
        notification_type: str,
        scope: str,
        title: str,
        message: str,
    ) -> None:
        if not self._email_enabled_for_notification(
            preference,
            notification_type=notification_type,
            scope=scope,
        ):
            return
        try:
            send_notification_email(recipient.email, title=title, message=message)
        except Exception:
            logger.exception(
                "notification email delivery failed",
                extra={"notification_type": notification_type, "recipient_id": recipient.user_id},
            )

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

        if not self._can_notify_recipient(
            db,
            recipient=recipient,
            notification_type=notification_type,
            space_id=space_id,
        ):
            return None
        scope = preference_scope_for_type(notification_type)
        preference = self._get_or_create_preference(db, user_id=recipient.user_id, scope=scope)
        app_enabled = self._app_enabled_for_notification(
            preference,
            notification_type=notification_type,
            scope=scope,
        )
        email_enabled = self._email_enabled_for_notification(
            preference,
            notification_type=notification_type,
            scope=scope,
        )
        if not app_enabled and not email_enabled:
            return None

        notification = None
        if app_enabled:
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
        self._send_email_if_enabled(
            recipient=recipient,
            preference=preference,
            notification_type=notification_type,
            scope=scope,
            title=title,
            message=message,
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
        email_defaults = default_preference_values(scope)["email_settings"]

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
            app_enabled = app_settings.get(notification_type, defaults.get(notification_type, True)) is True
            email_preference = preference or SimpleNamespace(
                user_id=user_id,
                email_enabled=default_preference_values(scope)["email_enabled"],
                email_frequency=default_preference_values(scope)["email_frequency"],
                email_settings=email_defaults,
            )
            email_enabled = self._email_enabled_for_notification(
                email_preference,
                notification_type=notification_type,
                scope=scope,
            )
            if not app_enabled and not email_enabled:
                continue

            if app_enabled:
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
            self._send_email_if_enabled(
                recipient=recipient,
                preference=email_preference,
                notification_type=notification_type,
                scope=scope,
                title=title,
                message=message,
            )
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

