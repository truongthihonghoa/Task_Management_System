from datetime import datetime
from app.core.timezone import vietnam_now

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification_preference import NotificationPreference


def get_preference(db: Session, *, user_id: str, scope: str) -> NotificationPreference | None:
    return db.execute(
        select(NotificationPreference)
        .where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.scope == scope,
        )
        .order_by(NotificationPreference.created_at.asc())
    ).scalars().first()


def list_preferences(db: Session, *, user_id: str, scopes: list[str]) -> list[NotificationPreference]:
    return list(
        db.execute(
            select(NotificationPreference)
            .where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.scope.in_(scopes),
            )
            .order_by(NotificationPreference.scope.asc(), NotificationPreference.created_at.asc())
        ).scalars()
    )


def list_preferences_for_users(
    db: Session,
    *,
    user_ids: list[str],
    scope: str,
) -> list[NotificationPreference]:
    if not user_ids:
        return []
    return list(
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id.in_(user_ids),
                NotificationPreference.scope == scope,
            )
        ).scalars()
    )


def create_preference(
    db: Session,
    *,
    user_id: str,
    scope: str,
    email_enabled: bool,
    email_frequency: str,
    email_settings: dict[str, bool],
    app_settings: dict[str, bool],
) -> NotificationPreference:
    preference = NotificationPreference(
        user_id=user_id,
        scope=scope,
        email_enabled=email_enabled,
        email_frequency=email_frequency,
        email_settings=email_settings,
        app_settings=app_settings,
    )
    db.add(preference)
    db.flush()
    return preference


def update_preference(
    db: Session,
    preference: NotificationPreference,
    *,
    email_enabled: bool | None = None,
    email_frequency: str | None = None,
    email_settings: dict[str, bool] | None = None,
    app_settings: dict[str, bool] | None = None,
) -> NotificationPreference:
    if email_enabled is not None:
        preference.email_enabled = email_enabled
    if email_frequency is not None:
        preference.email_frequency = email_frequency
    if email_settings is not None:
        preference.email_settings = email_settings
    if app_settings is not None:
        preference.app_settings = app_settings
    preference.updated_at = vietnam_now()
    db.flush()
    return preference
