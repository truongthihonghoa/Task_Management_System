"""Space API endpoints."""

import html
import os
from typing import List
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_bearer_token
from app.repository import space as space_crud
from app.db.session import get_db
from app.models.space_member_request import SpaceMemberRequest
from app.models.user import User
from app.schemas.pydantic_models import (
    SpaceAddPeopleRequest,
    SpaceAddPeopleResponse,
    SpaceCreate,
    SpaceMemberCreate,
    SpaceMemberRequestResponse,
    SpaceMemberResponse,
    SpaceMemberUpdate,
    SpaceResponse,
    SpaceUpdate,
)
from app.services import space_service


def _ensure_can_create_space(payload: SpaceCreate, current_user: User) -> None:
    if current_user.role != "USER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users can create spaces",
        )
    if payload.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Users can only create spaces for themselves",
        )


router = APIRouter(
    prefix="/spaces",
    tags=["spaces"],
)


def _frontend_url() -> str:
    return (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")


def _space_tasks_redirect(space_id: str, *, invite_status: str, message: str) -> RedirectResponse:
    query = urlencode({"invite": invite_status, "message": message})
    return RedirectResponse(
        url=f"{_frontend_url()}/dashboard/tasks/{space_id}?{query}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


def _create_account_redirect(*, email: str, space_id: str, message: str) -> RedirectResponse:
    query = urlencode(
        {
            "invite": "accepted",
            "email": email,
            "spaceId": space_id,
            "message": message,
        }
    )
    return RedirectResponse(
        url=f"{_frontend_url()}/create-account?{query}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


def _space_tasks_url(space_id: str, *, invite_status: str, message: str) -> str:
    query = urlencode({"invite": invite_status, "message": message})
    return f"{_frontend_url()}/dashboard/tasks/{space_id}?{query}"


def _create_account_url(*, email: str, space_id: str, message: str) -> str:
    query = urlencode(
        {
            "invite": "accepted",
            "email": email,
            "spaceId": space_id,
            "message": message,
        }
    )
    return f"{_frontend_url()}/create-account?{query}"


def _review_json_response(*, title: str, message: str, redirect_url: str | None = None) -> JSONResponse:
    return JSONResponse(
        {
            "title": title,
            "message": message,
            "redirect_url": redirect_url,
        },
        status_code=status.HTTP_200_OK,
    )


def _review_confirmation_response(*, title: str, message: str) -> HTMLResponse:
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    return HTMLResponse(
        content=f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{safe_title}</title>
  </head>
  <body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <section style="max-width:560px;width:100%;border:1px solid #E0D7F0;border-radius:16px;box-shadow:0 16px 42px rgba(76,43,116,0.12);overflow:hidden;">
        <div style="background:#4C2B74;color:#ffffff;padding:22px 28px;">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#EADFF9;">TaskFlow</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">{safe_title}</h1>
        </div>
        <div style="padding:26px 28px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">{safe_message}</p>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6E5A8A;">You can close this tab.</p>
        </div>
      </section>
    </main>
  </body>
</html>""",
        status_code=status.HTTP_200_OK,
    )


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(
    payload: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_can_create_space(payload, current_user)
    return space_crud.create_space(db, payload)


@router.get("", response_model=List[SpaceResponse])
def list_spaces(
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_spaces(db, include_deleted=include_deleted, current_user=current_user)


@router.get("/owners/{owner_id}/trash", response_model=List[SpaceResponse])
def list_owner_trash(
    owner_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_owner_trash(db, owner_id, current_user=current_user)


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.get_space(db, space_id, current_user=current_user)


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    space_id: str,
    payload: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.update_space(db, space_id, payload, current_user=current_user)


@router.post("/{space_id}/complete", response_model=SpaceResponse)
def complete_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.archive_space(db, space_id, current_user=current_user)


@router.post("/{space_id}/unarchive", response_model=SpaceResponse)
def unarchive_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.unarchive_space(db, space_id, current_user=current_user)


@router.post("/{space_id}/restore", response_model=SpaceResponse)
def restore_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.restore_space(db, space_id, current_user=current_user)


@router.delete("/{space_id}", response_model=SpaceResponse)
def delete_space(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.delete_space(db, space_id, current_user=current_user)


@router.get("/{space_id}/members", response_model=List[SpaceMemberResponse])
def list_space_members(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_space_members(db, space_id, current_user=current_user)


@router.get("/{space_id}/member-requests", response_model=List[SpaceMemberRequestResponse])
def list_pending_space_member_requests(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.list_pending_space_member_requests(db, space_id, current_user=current_user)


@router.delete("/{space_id}/people")
def remove_space_people_target(
    space_id: str,
    target_type: str = Query(..., pattern="^(member|request)$"),
    target_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.remove_space_people_target(
        db,
        space_id,
        target_type=target_type,
        target_id=target_id,
        current_user=current_user,
    )


@router.post("/{space_id}/people", response_model=SpaceAddPeopleResponse)
def add_people_to_space(
    space_id: str,
    payload: SpaceAddPeopleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return space_crud.add_people_to_space(db, space_id, payload, current_user=current_user)


@router.get("/member-requests/{review_token}/approve")
def approve_space_member_request(
    review_token: str,
    response: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    wants_json = response == "json"
    member_request = (
        db.query(SpaceMemberRequest)
        .filter(SpaceMemberRequest.review_token == review_token)
        .first()
    )
    if member_request is None:
        if wants_json:
            return _review_json_response(
                title="Request already handled",
                message="This approval link was already used or has expired. If it was approved, the invitation email has already been sent.",
            )
        return _review_confirmation_response(
            title="Request already handled",
            message="This approval link was already used or has expired. If it was approved, the invitation email has already been sent.",
        )
    request_status = member_request.status
    space_id = member_request.space_id
    message = space_crud.review_space_member_request(db, review_token, approve=True)
    if request_status == "PENDING_OWNER":
        if wants_json:
            return _review_json_response(
                title="Invitation email sent",
                message=message,
            )
        return _review_confirmation_response(
            title="Invitation email sent",
            message=message,
        )
    if request_status not in ("PENDING_INVITEE",):
        if wants_json:
            return _review_json_response(
                title="Request already handled",
                message=message,
            )
        return _review_confirmation_response(
            title="Request already handled",
            message=message,
        )
    if member_request.requested_user_id is None:
        if wants_json:
            return _review_json_response(
                title="Invitation accepted",
                message=message,
                redirect_url=_create_account_url(
                    email=member_request.requested_email,
                    space_id=space_id,
                    message=message,
                ),
            )
        return _create_account_redirect(
            email=member_request.requested_email,
            space_id=space_id,
            message=message,
        )
    if wants_json:
        return _review_json_response(
            title="Invitation accepted",
            message=message,
            redirect_url=_space_tasks_url(space_id, invite_status="accepted", message=message),
        )
    return _space_tasks_redirect(space_id, invite_status="accepted", message=message)


@router.get("/member-requests/{review_token}/reject")
def reject_space_member_request(
    review_token: str,
    response: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    wants_json = response == "json"
    member_request = (
        db.query(SpaceMemberRequest)
        .filter(SpaceMemberRequest.review_token == review_token)
        .first()
    )
    if member_request is None:
        if wants_json:
            return _review_json_response(
                title="Request already handled",
                message="This review link was already used or has expired.",
            )
        return _review_confirmation_response(
            title="Request already handled",
            message="This review link was already used or has expired.",
        )
    message = space_crud.review_space_member_request(db, review_token, approve=False)
    if wants_json:
        return _review_json_response(
            title="Request rejected",
            message=message,
        )
    return _review_confirmation_response(
        title="Request rejected",
        message=message,
    )
