from datetime import datetime
from app.core.timezone import vietnam_now

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.user import User
from app.repository import main_layout as main_layout_repository
from app.repository import recent_view as recent_view_repository
from app.schemas.pydantic_models import UpdateProfileRequest, UserProfileResponse
from app.schemas.main_layout import (
    GlobalSearchAssigneeItem,
    GlobalSearchResponse,
    GlobalSearchSpaceItem,
    GlobalSearchTaskItem,
    GlobalSearchUserItem,
    GlobalSearchOwnerItem,
    MainLayoutPreferencesResponse,
    SpaceContextResponse,
    SpacePermissionResponse,
)

SEARCH_TYPES = {"spaces", "tasks", "users"}
DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = {"en", "vi"}


def initials_for_name(full_name: str) -> str:
    parts = [part for part in full_name.strip().split() if part]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


def _search_user_display(user: User) -> tuple[str, str | None]:
    if user.role == "SUPER_ADMIN":
        return "Super Admin", "System"

    active_owned_spaces = [
        space
        for space in getattr(user, "owned_spaces", [])
        if space.deleted_at is None and space.status_space != "Deleted"
    ]
    if active_owned_spaces:
        space = sorted(
            active_owned_spaces,
            key=lambda item: item.updated_at or item.created_at or datetime.min,
            reverse=True,
        )[0]
        return "Owner", space.name_space

    active_memberships = [
        membership
        for membership in getattr(user, "space_memberships", [])
        if membership.status == "Active"
        and membership.removed_at is None
        and membership.space is not None
        and membership.space.deleted_at is None
        and membership.space.status_space != "Deleted"
    ]
    if active_memberships:
        owner_membership = next((item for item in active_memberships if item.role == "OWNER"), None)
        membership = owner_membership or active_memberships[0]
        return ("Owner" if membership.role == "OWNER" else "User"), membership.space.name_space

    return "User", None


def _is_space_deleted(space: Space) -> bool:
    return space.deleted_at is not None or space.status_space == "Deleted"


def _space_role(space: Space, member: SpaceMember | None, user: User) -> str:
    if user.role == "SUPER_ADMIN":
        return "SUPER_ADMIN"
    if space.owner_id == user.user_id:
        return "OWNER"
    if member is not None and member.role == "OWNER":
        return "OWNER"
    return "USER"


def _permissions_for_space_role(space_role: str) -> SpacePermissionResponse:
    if space_role == "SUPER_ADMIN":
        return SpacePermissionResponse(
            can_view=True,
            can_create_task=False,
            can_update_space=False,
            can_manage_members=False,
            can_assign_task=False,
        )
    if space_role == "OWNER":
        return SpacePermissionResponse(
            can_view=True,
            can_create_task=True,
            can_update_space=True,
            can_manage_members=True,
            can_assign_task=True,
        )
    return SpacePermissionResponse(
        can_view=True,
        can_create_task=True,
        can_update_space=False,
        can_manage_members=False,
        can_assign_task=True,
    )


def get_preferences(db: Session, user: User) -> MainLayoutPreferencesResponse:
    preference = main_layout_repository.get_user_preference(db, user.user_id)
    return MainLayoutPreferencesResponse(language=preference.language if preference else DEFAULT_LANGUAGE)


def update_language(db: Session, *, user: User, language: str) -> MainLayoutPreferencesResponse:
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Unsupported language.", "supported_languages": sorted(SUPPORTED_LANGUAGES)},
        )

    preference = main_layout_repository.get_user_preference(db, user.user_id)
    if preference is None:
        preference = main_layout_repository.create_user_preference(db, user_id=user.user_id, language=language)
    else:
        main_layout_repository.update_user_preference(preference, language=language)

    return MainLayoutPreferencesResponse(language=preference.language)


def get_profile(user: User) -> UserProfileResponse:
    return UserProfileResponse.model_validate(user)


def update_profile(db: Session, *, user: User, payload: UpdateProfileRequest) -> UserProfileResponse:
    user.full_name = payload.full_name
    user.updated_at = vietnam_now()
    return UserProfileResponse.model_validate(user)


def get_space_context(db: Session, *, space_id: str, user: User) -> SpaceContextResponse:
    space = main_layout_repository.get_space_for_context(db, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")
    if _is_space_deleted(space):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    member = main_layout_repository.get_active_space_member(db, space_id=space_id, user_id=user.user_id)
    if user.role != "SUPER_ADMIN" and space.owner_id != user.user_id and member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    space_role = _space_role(space, member, user)
    recent_view_repository.record_recent_view(
        db,
        user_id=user.user_id,
        entity_type="space",
        entity_id=space.space_id,
    )
    return SpaceContextResponse(
        space_id=space.space_id,
        space_name=space.name_space,
        space_role=space_role,
        permissions=_permissions_for_space_role(space_role),
    )


def _parse_types(types: str | None) -> set[str]:
    if not types:
        return set(SEARCH_TYPES)
    parsed = {item.strip().lower() for item in types.split(",") if item.strip()}
    invalid = parsed - SEARCH_TYPES
    if invalid:
        raise HTTPException(
            status_code=422,
            detail={"message": "Invalid search types.", "invalid_types": sorted(invalid)},
        )
    return parsed or set(SEARCH_TYPES)


def _viewed_at(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _space_item(row: tuple[Space, int] | tuple[Space, int, datetime]) -> GlobalSearchSpaceItem:
    viewed_at = None
    if len(row) == 3:
        space, member_count, viewed_at = row
    else:
        space, member_count = row
    owner = space.owner
    return GlobalSearchSpaceItem(
        space_id=space.space_id,
        name=space.name_space,
        description=space.description,
        owner=GlobalSearchOwnerItem(
            user_id=owner.user_id,
            full_name=owner.full_name,
            initials=initials_for_name(owner.full_name),
        ),
        member_count=int(member_count or 0),
        status=space.status_space,
        viewed_at=_viewed_at(viewed_at),
    )


def _task_item(task: Task, viewed_at: datetime | None = None) -> GlobalSearchTaskItem:
    return GlobalSearchTaskItem(
        task_id=task.task_id,
        title=task.title,
        status=task.task_status,
        priority=task.priority,
        space_id=task.space_id,
        space_name=task.space.name_space if task.space else "",
        assignees=[
            GlobalSearchAssigneeItem(user_id=entry.assignee.user_id, full_name=entry.assignee.full_name)
            for entry in task.assignees
            if entry.assignee is not None
        ],
        viewed_at=_viewed_at(viewed_at),
    )


def _user_item(user: User, viewed_at: datetime | None = None) -> GlobalSearchUserItem:
    display_role, space_name = _search_user_display(user)
    return GlobalSearchUserItem(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        initials=initials_for_name(user.full_name),
        system_role=user.role,
        display_role=display_role,
        status=user.status_user,
        space_name=space_name,
        viewed_at=_viewed_at(viewed_at),
    )


def _recent_search(
    db: Session,
    *,
    user: User,
    selected_types: set[str],
    limit_per_type: int,
    space_id: str | None,
) -> GlobalSearchResponse:
    spaces = []
    tasks = []
    users = []
    if "spaces" in selected_types:
        spaces = [_space_item(row) for row in recent_view_repository.list_recent_spaces(db, user=user, limit=limit_per_type)]
    if "tasks" in selected_types:
        tasks = [
            _task_item(task, viewed_at)
            for task, viewed_at in recent_view_repository.list_recent_tasks(
                db,
                user=user,
                limit=limit_per_type,
                space_id=space_id,
            )
        ]
    if "users" in selected_types and user.role == "SUPER_ADMIN":
        users = [
            _user_item(item, viewed_at)
            for item, viewed_at in recent_view_repository.list_recent_users(db, user=user, limit=limit_per_type)
        ]
    return GlobalSearchResponse(query="", spaces=spaces, tasks=tasks, users=users)


def global_search(
    db: Session,
    *,
    user: User,
    q: str | None,
    types: str | None,
    limit_per_type: int,
    space_id: str | None = None,
    include_recent: bool = True,
) -> GlobalSearchResponse:
    query_text = (q or "").strip()
    selected_types = _parse_types(types)
    if not query_text and not include_recent:
        return GlobalSearchResponse(query=query_text)
    if not query_text:
        return _recent_search(
            db,
            user=user,
            selected_types=selected_types,
            limit_per_type=limit_per_type,
            space_id=space_id,
        )

    spaces = []
    tasks = []
    users = []
    if "spaces" in selected_types:
        spaces = [
            _space_item(row)
            for row in main_layout_repository.search_spaces(
                db,
                user=user,
                query_text=query_text,
                limit=limit_per_type,
            )
        ]
    if "tasks" in selected_types:
        tasks = [
            _task_item(task)
            for task in main_layout_repository.search_tasks(
                db,
                user=user,
                query_text=query_text,
                limit=limit_per_type,
                space_id=space_id,
            )
        ]
    if "users" in selected_types and user.role == "SUPER_ADMIN":
        users = [
            _user_item(item)
            for item in main_layout_repository.search_users(
                db,
                query_text=query_text,
                limit=limit_per_type,
            )
        ]

    return GlobalSearchResponse(query=query_text, spaces=spaces, tasks=tasks, users=users)
