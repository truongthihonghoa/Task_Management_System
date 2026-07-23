from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.notification_constants import (
    NotificationEmailFrequency,
    NotificationPreferenceScope,
    SETTINGS_KEYS_BY_SCOPE,
    default_preference_values,
)
from app.repository import notification_preference as preference_repository
from app.models.notification_preference import NotificationPreference
from app.models.user import User
from app.schemas.notification_preference import (
    NotificationPreferencePatchRequest,
    NotificationPreferenceUpdateRequest,
)


class NotificationPreferenceService:
    supported_email_frequencies = {
        NotificationEmailFrequency.INSTANT.value,
        NotificationEmailFrequency.OFF.value,
    }

    def allowed_scopes_for_user(self, user: User) -> list[str]:
        scopes = [NotificationPreferenceScope.USER_ACCOUNT.value]
        if user.role == "SUPER_ADMIN":
            scopes.append(NotificationPreferenceScope.SUPER_ADMIN.value)
        return scopes

    def ensure_scope_access(self, user: User, scope: str) -> None:
        if scope == NotificationPreferenceScope.SUPER_ADMIN.value and user.role != "SUPER_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    def validate_settings(self, scope: str, settings: dict[str, bool]) -> dict[str, bool]:
        if not isinstance(settings, dict):
            raise HTTPException(status_code=422, detail="Settings must be an object.")

        allowed_keys = SETTINGS_KEYS_BY_SCOPE[scope]
        invalid_keys = sorted(set(settings) - allowed_keys)
        if invalid_keys:
            raise HTTPException(
                status_code=422,
                detail={"message": "Unsupported notification type for scope.", "invalid_keys": invalid_keys},
            )

        invalid_value_keys = [key for key, value in settings.items() if not isinstance(value, bool)]
        if invalid_value_keys:
            raise HTTPException(
                status_code=422,
                detail={"message": "Setting values must be boolean.", "invalid_keys": invalid_value_keys},
            )

        return dict(settings)

    def validate_email_frequency(self, frequency: NotificationEmailFrequency) -> NotificationEmailFrequency:
        if frequency.value not in self.supported_email_frequencies:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Digest email delivery is not available yet. Use INSTANT or OFF.",
                    "supported_values": sorted(self.supported_email_frequencies),
                },
            )
        return frequency

    def ensure_preference(self, db: Session, *, user_id: str, scope: str) -> NotificationPreference:
        preference = preference_repository.get_preference(db, user_id=user_id, scope=scope)
        if preference is not None:
            return preference

        defaults = default_preference_values(scope)
        return preference_repository.create_preference(
            db,
            user_id=user_id,
            scope=scope,
            email_enabled=defaults["email_enabled"],
            email_frequency=defaults["email_frequency"],
            email_settings=defaults["email_settings"],
            app_settings=defaults["app_settings"],
        )

    def get_preferences_for_user(self, db: Session, *, user: User) -> list[NotificationPreference]:
        preferences = []
        for scope in self.allowed_scopes_for_user(user):
            preferences.append(self.ensure_preference(db, user_id=user.user_id, scope=scope))
        return preferences

    def get_preference_for_user(self, db: Session, *, user: User, scope: str) -> NotificationPreference:
        self.ensure_scope_access(user, scope)
        return self.ensure_preference(db, user_id=user.user_id, scope=scope)

    def update_preference(
        self,
        db: Session,
        *,
        user: User,
        scope: str,
        payload: NotificationPreferenceUpdateRequest,
    ) -> NotificationPreference:
        self.ensure_scope_access(user, scope)
        email_settings = self.validate_settings(scope, dict(payload.email_settings))
        app_settings = self.validate_settings(scope, dict(payload.app_settings))
        email_frequency = self.validate_email_frequency(payload.email_frequency)
        preference = self.ensure_preference(db, user_id=user.user_id, scope=scope)
        return preference_repository.update_preference(
            db,
            preference,
            email_enabled=payload.email_enabled,
            email_frequency=email_frequency.value,
            email_settings=email_settings,
            app_settings=app_settings,
        )

    def patch_preference(
        self,
        db: Session,
        *,
        user: User,
        scope: str,
        payload: NotificationPreferencePatchRequest,
    ) -> NotificationPreference:
        self.ensure_scope_access(user, scope)
        preference = self.ensure_preference(db, user_id=user.user_id, scope=scope)

        update_data = payload.model_dump(exclude_unset=True)
        email_settings = None
        app_settings = None
        if "email_settings" in update_data:
            if update_data["email_settings"] is None:
                raise HTTPException(
                    status_code=422,
                    detail="email_settings must be an object.",
                )
            email_settings = {
                **(preference.email_settings or default_preference_values(scope)["email_settings"]),
                **self.validate_settings(scope, dict(update_data["email_settings"])),
            }
        if "app_settings" in update_data:
            if update_data["app_settings"] is None:
                raise HTTPException(
                    status_code=422,
                    detail="app_settings must be an object.",
                )
            app_settings = {
                **(preference.app_settings or default_preference_values(scope)["app_settings"]),
                **self.validate_settings(scope, dict(update_data["app_settings"])),
            }

        email_frequency = update_data.get("email_frequency")
        if email_frequency is not None:
            email_frequency = self.validate_email_frequency(email_frequency)
        return preference_repository.update_preference(
            db,
            preference,
            email_enabled=update_data.get("email_enabled"),
            email_frequency=email_frequency.value if email_frequency is not None else None,
            email_settings=email_settings,
            app_settings=app_settings,
        )

    def reset_preference(self, db: Session, *, user: User, scope: str) -> NotificationPreference:
        self.ensure_scope_access(user, scope)
        preference = self.ensure_preference(db, user_id=user.user_id, scope=scope)
        defaults = default_preference_values(scope)
        return preference_repository.update_preference(
            db,
            preference,
            email_enabled=defaults["email_enabled"],
            email_frequency=defaults["email_frequency"],
            email_settings=defaults["email_settings"],
            app_settings=defaults["app_settings"],
        )
