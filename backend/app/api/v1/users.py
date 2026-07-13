from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repository import user as user_crud
from app.schemas.pydantic_models import (
    UserManagementListResponse,
    UserManagementResponse,
    UserManagementUpdateRequest,
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

    total, items = user_crud.list_users(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        sort_by=sort_by,
        sort_order=sort_order.lower(),
    )
    user_crud.create_user_audit_log(
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


@router.get("/{user_id}", response_model=UserManagementResponse)
def get_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    user = user_crud.get_user_details(db, user_id)
    user_crud.create_user_audit_log(
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
    user_crud.validate_update_payload(payload)
    allowed_payload = UserManagementUpdateRequest(**payload)
    if hasattr(allowed_payload, "model_dump"):
        update_data = allowed_payload.model_dump(exclude_unset=True)
    else:
        update_data = allowed_payload.dict(exclude_unset=True)

    try:
        user = user_crud.update_user(db, user_id, update_data)
        user_crud.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UPDATE_USER",
            entity_id=user_id,
            payload=update_data,
            ip_address=_get_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return user


@router.patch("/{user_id}/activate", response_model=UserManagementResponse)
def activate_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    try:
        user = user_crud.activate_user(db, user_id)
        user_crud.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="ACTIVATE_USER",
            entity_id=user_id,
            payload={"status": "Active"},
            ip_address=_get_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return user


@router.patch("/{user_id}/deactivate", response_model=UserManagementResponse)
def deactivate_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    try:
        user = user_crud.deactivate_user(db, user_id)
        user_crud.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="DEACTIVATE_USER",
            entity_id=user_id,
            payload={"status": "Inactive"},
            ip_address=_get_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return user


@router.patch("/{user_id}/lock", response_model=UserManagementResponse)
def lock_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    try:
        user = user_crud.lock_user(db, user_id)
        user_crud.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="LOCK_USER",
            entity_id=user_id,
            payload={"status": "Locked", "locked_until": user.locked_until.isoformat() if user.locked_until else None},
            ip_address=_get_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return user


@router.patch("/{user_id}/unlock", response_model=UserManagementResponse)
def unlock_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserManagementResponse:
    _ensure_super_admin(current_user)
    try:
        user = user_crud.unlock_user(db, user_id)
        user_crud.create_user_audit_log(
            db,
            actor_user_id=current_user.user_id,
            action="UNLOCK_USER",
            entity_id=user_id,
            payload={"status": "Active", "failed_login_attempts": 0, "locked_until": None},
            ip_address=_get_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return user
