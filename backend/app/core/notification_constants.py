from enum import Enum


class NotificationType(str, Enum):
    TASK_ASSIGNED = "task_assigned"
    TASK_MENTIONED = "task_mentioned"
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_DELETED = "task_deleted"
    STATUS_CHANGED = "status_changed"
    PRIORITY_CHANGED = "priority_changed"
    COMMENT_ADDED = "comment_added"
    COMMENT_EDITED = "comment_edited"
    COMMENT_DELETED = "comment_deleted"
    ATTACHMENT_ADDED = "attachment_added"
    DUE_TODAY = "due_today"
    DUE_DATE_CHANGED = "due_date_changed"
    TASK_OVERDUE = "task_overdue"
    USER_REGISTERED = "user_registered"
    ACCOUNT_LOCKED = "account_locked"
    USER_VERIFIED = "user_verified"
    USER_DEACTIVATED = "user_deactivated"
    ROLE_CHANGED = "role_changed"
    PERMISSION_CHANGED = "permission_changed"
    SPACE_CREATED = "space_created"
    SPACE_UPDATED = "space_updated"
    SPACE_MEMBER_ADDED = "space_member_added"
    SPACE_ROLE_CHANGED = "space_role_changed"
    OWNER_SPACE_UPDATE = "owner_space_update"
    AUDIT_LOG_EVENT = "audit_log_event"
    SYSTEM_ALERT = "system_alert"


class NotificationAudience(str, Enum):
    USER = "USER"
    OWNER = "OWNER"
    SUPER_ADMIN = "SUPER_ADMIN"


class NotificationPreferenceScope(str, Enum):
    USER_ACCOUNT = "USER_ACCOUNT"
    SUPER_ADMIN = "SUPER_ADMIN"


class NotificationEmailFrequency(str, Enum):
    INSTANT = "INSTANT"
    DAILY_DIGEST = "DAILY_DIGEST"
    WEEKLY_DIGEST = "WEEKLY_DIGEST"
    OFF = "OFF"


class NotificationReadStatus(str, Enum):
    READ = "read"
    UNREAD = "unread"


class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"


TASK_ACTIVITY_TYPES = {
    NotificationType.TASK_ASSIGNED.value,
    NotificationType.TASK_MENTIONED.value,
    NotificationType.TASK_CREATED.value,
    NotificationType.TASK_UPDATED.value,
    NotificationType.TASK_DELETED.value,
    NotificationType.STATUS_CHANGED.value,
    NotificationType.PRIORITY_CHANGED.value,
    NotificationType.COMMENT_ADDED.value,
    NotificationType.COMMENT_EDITED.value,
    NotificationType.COMMENT_DELETED.value,
    NotificationType.ATTACHMENT_ADDED.value,
    NotificationType.DUE_TODAY.value,
    NotificationType.DUE_DATE_CHANGED.value,
    NotificationType.TASK_OVERDUE.value,
}

SPACE_ACTIVITY_TYPES = {
    NotificationType.SPACE_CREATED.value,
    NotificationType.SPACE_UPDATED.value,
    NotificationType.SPACE_MEMBER_ADDED.value,
    NotificationType.SPACE_ROLE_CHANGED.value,
}

SUPER_ADMIN_TYPES = {
    NotificationType.USER_REGISTERED.value,
    NotificationType.ACCOUNT_LOCKED.value,
    NotificationType.USER_VERIFIED.value,
    NotificationType.USER_DEACTIVATED.value,
    NotificationType.ROLE_CHANGED.value,
    NotificationType.PERMISSION_CHANGED.value,
    NotificationType.AUDIT_LOG_EVENT.value,
    NotificationType.SYSTEM_ALERT.value,
}

OWNER_LEVEL_TYPES = {NotificationType.OWNER_SPACE_UPDATE.value}

USER_ACCOUNT_TYPES = TASK_ACTIVITY_TYPES | SPACE_ACTIVITY_TYPES | OWNER_LEVEL_TYPES
VALID_NOTIFICATION_TYPES = USER_ACCOUNT_TYPES | SUPER_ADMIN_TYPES
VALID_AUDIENCES = {item.value for item in NotificationAudience}

DEFAULT_USER_ACCOUNT_EMAIL_SETTINGS = {
    "task_assigned": True,
    "status_changed": True,
    "comment_added": True,
    "due_date_changed": True,
    "task_mentioned": True,
    "space_member_added": True,
    "space_role_changed": True,
    "owner_space_update": True,
}

DEFAULT_USER_ACCOUNT_APP_SETTINGS = DEFAULT_USER_ACCOUNT_EMAIL_SETTINGS.copy()

DEFAULT_SUPER_ADMIN_EMAIL_SETTINGS = {
    "user_registered": True,
    "account_locked": True,
    "user_verified": True,
    "user_deactivated": True,
    "role_changed": True,
    "permission_changed": True,
    "audit_log_event": True,
    "system_alert": True,
}

DEFAULT_SUPER_ADMIN_APP_SETTINGS = DEFAULT_SUPER_ADMIN_EMAIL_SETTINGS.copy()

SETTINGS_KEYS_BY_SCOPE = {
    NotificationPreferenceScope.USER_ACCOUNT.value: USER_ACCOUNT_TYPES,
    NotificationPreferenceScope.SUPER_ADMIN.value: SUPER_ADMIN_TYPES,
}


def default_preference_values(scope: str) -> dict:
    if scope == NotificationPreferenceScope.SUPER_ADMIN.value:
        return {
            "scope": scope,
            "email_enabled": True,
            "email_frequency": NotificationEmailFrequency.INSTANT.value,
            "email_settings": DEFAULT_SUPER_ADMIN_EMAIL_SETTINGS.copy(),
            "app_settings": DEFAULT_SUPER_ADMIN_APP_SETTINGS.copy(),
        }
    return {
        "scope": NotificationPreferenceScope.USER_ACCOUNT.value,
        "email_enabled": True,
        "email_frequency": NotificationEmailFrequency.INSTANT.value,
        "email_settings": DEFAULT_USER_ACCOUNT_EMAIL_SETTINGS.copy(),
        "app_settings": DEFAULT_USER_ACCOUNT_APP_SETTINGS.copy(),
    }


def preference_scope_for_type(notification_type: str) -> str:
    if notification_type in SUPER_ADMIN_TYPES:
        return NotificationPreferenceScope.SUPER_ADMIN.value
    return NotificationPreferenceScope.USER_ACCOUNT.value
