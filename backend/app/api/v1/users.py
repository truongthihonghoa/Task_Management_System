from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status, UploadFile, File
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repository import user as user_repo
from app.services import user_service
from app.schemas.pydantic_models import (
    ChangePasswordRequest,
    MessageResponse,
    UpdateAvatarResponse,
    UpdateProfileRequest,
    UserManagementListResponse,
    UserManagementResponse,
    UserManagementUpdateRequest,
    UserProfileResponse,
    UserStatusUpdateRequest,
    UserLockUpdateRequest,
)


router = APIRouter(prefix="/users", tags=["users"])


def _get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _ensure_super_admin(current_user: User) -> None:
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SUPER_ADMIN access required.")


def _validate_pagination(page: int, page_size: int) -> None:
    if page < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="page must be greater than or equal to 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="page_size must be between 1 and 100")


@router.get("", response_model=UserManagementListResponse)
def get_users(
    request: Request,
    page: int = Query(default=1),
    page_size: int = Query(default=20),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementListResponse:
    _ensure_super_admin(current_user)
    _validate_pagination(page, page_size)

    total, items = user_service.list_users(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        sort_by=sort_by,
        sort_order=sort_order.lower(),
    )
    user_repo.create_user_audit_log(
        db,
        actor_user_id=current_user.user_id,
        action="VIEW_USERS",
        entity_id=None,
        payload={
            "page": page,
            "page_size": page_size,
            "search": search,
            "status": status_filter,
            "sort_by": sort_by,
            "sort_order": sort_order,
        },
        ip_address=_get_client_ip(request),
    )
    db.commit()
    return UserManagementListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    profile = user_service.get_user_profile(db, current_user.user_id)
    user_repo.create_user_audit_log(
        db,
        actor_user_id=current_user.user_id,
        action="VIEW_PROFILE",
        entity_id=current_user.user_id,
        payload=None,
        ip_address=_get_client_ip(request),
    )
    db.commit()
    return profile


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    request: Request,
    payload: UpdateProfileRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    try:
        profile = user_service.update_user_profile(db, current_user.user_id, payload)
        user_repo.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UPDATE_PROFILE",
            entity_id=current_user.user_id,
            payload=payload.model_dump() if hasattr(payload, "model_dump") else payload.dict(),
            ip_address=_get_client_ip(request),
        )
        db.commit()
        return profile
    except Exception:
        db.rollback()
        raise


@router.put("/profile/avatar", response_model=UpdateAvatarResponse)
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UpdateAvatarResponse:
    try:
        avatar_url = user_service.update_user_avatar(db, current_user.user_id, file)
        user_repo.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UPLOAD_AVATAR",
            entity_id=current_user.user_id,
            payload={"avatar_url": avatar_url},
            ip_address=_get_client_ip(request),
        )
        db.commit()
        return UpdateAvatarResponse(message="Avatar updated successfully.", avatar_url=avatar_url)
    except Exception:
        db.rollback()
        raise


@router.put("/change-password", response_model=MessageResponse)
def change_password(
    request: Request,
    payload: ChangePasswordRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    try:
        user_service.change_user_password(db, current_user.user_id, payload)
        user_repo.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="CHANGE_PASSWORD",
            entity_id=current_user.user_id,
            payload=None,
            ip_address=_get_client_ip(request),
        )
        db.commit()
        return MessageResponse(message="Password changed successfully. Please log in again.")
    except Exception:
        db.rollback()
        raise


@router.get("/{user_id}", response_model=UserManagementResponse)
def get_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    user = user_service.get_user_details(db, user_id)
    user_repo.create_user_audit_log(
        db,
        actor_user_id=current_user.user_id,
        action="VIEW_USER",
        entity_id=user_id,
        payload={"user_id": user_id},
        ip_address=_get_client_ip(request),
    )
    db.commit()
    return user


@router.patch("/{user_id}", response_model=UserManagementResponse)
def update_user(
    user_id: str,
    request: Request,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    try:
        user = user_service.update_user(db, user_id, payload)
        user_repo.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UPDATE_USER",
            entity_id=user_id,
            payload=payload,
            ip_address=_get_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return user


@router.patch("/{user_id}/status", response_model=UserManagementResponse)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)

    try:
        user = user_service.update_user_status(
            db,
            user_id,
            payload.status,
            actor_id=current_user.user_id,
        )

        user_repo.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UPDATE_USER_STATUS",
            entity_id=user_id,
            payload={"status": payload.status},
            ip_address=_get_client_ip(request),
        )

        db.commit()

    except Exception:
        db.rollback()
        raise

    return user

@router.patch("/{user_id}/lock-status", response_model=UserManagementResponse)
def update_user_lock_status(
    user_id: str,
    payload: UserLockUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)

    try:
        user = user_service.update_user_lock_status(
            db,
            user_id,
            payload.locked,
            actor_id=current_user.user_id,
        )

        user_repo.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UPDATE_USER_LOCK_STATUS",
            entity_id=user_id,
            payload={
                "locked": payload.locked,
                "locked_until": user.locked_until.isoformat() if user.locked_until else None,
            },
            ip_address=_get_client_ip(request),
        )

        db.commit()

    except Exception:
        db.rollback()
        raise

    return user
