"""Database operations and rules for spaces."""
"""
space_repository.py — Database operations and space business logic.

Moved from crud/space.py as part of the crud → repository rename.
"""

import html
import os
import secrets
from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.email import get_email_service
from app.models.notification import Notification
from app.models.recent_view import RecentView
from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.space_member_request import SpaceMemberRequest
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.task_assignment_history import TaskAssignmentHistory
from app.models.task_attachment import TaskAttachment
from app.models.task_comment import TaskComment
from app.models.user import User
from app.services.notification_service import NotificationService

from app.schemas.pydantic_models import (
    SpaceAddPeopleRequest,
    SpaceAddPeopleResponse,
    SpaceCreate,
    SpaceMemberResponse,
    SpaceMemberRequestResponse,
    SpaceResponse,
    SpaceUpdate,
    UserSummaryResponse,
)


TRASH_RETENTION_DAYS = 14
SPACE_REOPEN_DAYS = 7
notification_service = NotificationService()


def _trash_expires_at(space: Space) -> datetime | None:
    if not space.deleted_at:
        return None
    return space.deleted_at + timedelta(days=TRASH_RETENTION_DAYS)


def _is_trash_expired(space: Space, now: datetime | None = None) -> bool:
    expires_at = _trash_expires_at(space)
    if not expires_at:
        return False
    return expires_at <= (now or vietnam_now())


def _space_reopen_until(archived_at: datetime) -> datetime:
    return archived_at + timedelta(days=SPACE_REOPEN_DAYS)


def _can_reopen_space(space: Space, now: datetime | None = None) -> bool:
    if space.status_space != "Archived" or space.deleted_at is not None:
        return False
    reopen_until = getattr(space, "reopen_until", None)
    if reopen_until is None:
        return False
    return reopen_until > (now or vietnam_now())


def _normalize_space_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space name is required",
        )
    return normalized


def _ensure_active_owner(owner: User) -> None:
    if owner.status_user != "Active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner is not active",
        )


def _is_active_space_member(db: Session, space_id: str, user_id: str) -> bool:
    return (
        db.query(SpaceMember)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .first()
        is not None
    )


def _can_view_space(db: Session, space: Space, current_user: User) -> bool:
    if current_user.role == "SUPER_ADMIN":
        return True
    if space.owner_id == current_user.user_id:
        return True
    return _is_active_space_member(db, space.space_id, current_user.user_id)


def _ensure_can_view_space(db: Session, space: Space, current_user: User) -> None:
    if not _can_view_space(db, space, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )


def _ensure_can_request_space_people(current_user: User) -> None:
    if current_user.role in {"ADMIN", "SUPER_ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ADMIN and SUPER_ADMIN cannot add people to spaces",
        )


def _ensure_space_owner(space: Space, current_user: User) -> None:
    if space.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the space owner can perform this action",
        )


def _ensure_space_mutable(space: Space) -> None:
    if space.status_space == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is archived",
        )
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is deleted",
        )


def _ensure_space_can_be_deleted(space: Space) -> None:
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is already deleted",
        )


def _ensure_space_name_available(
    db: Session,
    *,
    owner_id: str,
    name_space: str,
    exclude_space_id: str | None = None,
) -> None:
    query = db.query(Space).filter(
        Space.owner_id == owner_id,
        Space.status_space != "Deleted",
        Space.deleted_at.is_(None),
        func.lower(func.trim(Space.name_space)) == name_space.lower(),
    )
    if exclude_space_id:
        query = query.filter(Space.space_id != exclude_space_id)

    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Space name already exists",
        )


def _active_task_counts_for_spaces(db: Session, space_ids: list[str]) -> dict[str, int]:
    if not space_ids:
        return {}

    query = getattr(db, "query", None)
    if query is None:
        return {}

    try:
        rows = (
            query(Task.space_id, func.count(Task.task_id))
            .filter(Task.space_id.in_(space_ids), Task.deleted_at.is_(None))
            .group_by(Task.space_id)
            .all()
        )
    except TypeError:
        return {}
    return {space_id: int(task_count or 0) for space_id, task_count in rows}


def _active_task_count_for_space(db: Session, space_id: str) -> int:
    return _active_task_counts_for_spaces(db, [space_id]).get(space_id, 0)


def _ensure_space_completion_requirements(db: Session, space_id: str) -> None:
    unfinished_task_count = (
        db.query(func.count(Task.task_id))
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
            Task.task_status != "done",
        )
        .scalar()
        or 0
    )
    incomplete_sprint_count = (
        db.query(func.count(Sprint.sprint_id))
        .filter(
            Sprint.space_id == space_id,
            Sprint.status != "Completed",
            Sprint.status != "Deleted",
        )
        .scalar()
        or 0
    )
    pending_invitation_count = (
        db.query(func.count(SpaceMemberRequest.space_member_request_id))
        .filter(
            SpaceMemberRequest.space_id == space_id,
            SpaceMemberRequest.status.in_(["PENDING_OWNER", "PENDING_INVITEE"]),
        )
        .scalar()
        or 0
    )

    blockers = []
    if unfinished_task_count:
        blockers.append(f"{unfinished_task_count} task(s) are not done")
    if incomplete_sprint_count:
        blockers.append(f"{incomplete_sprint_count} sprint(s) are not completed")
    if pending_invitation_count:
        blockers.append(f"{pending_invitation_count} member invitation(s) are still pending")

    if blockers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete space: {', '.join(blockers)}.",
        )


def _space_response(space: Space, *, task_count: int = 0) -> SpaceResponse:
    return SpaceResponse(
        space_id=space.space_id,
        name_space=space.name_space,
        description=space.description,
        owner_id=space.owner_id,
        status_space=space.status_space,
        task_count=task_count,
        created_at=space.created_at,
        updated_at=space.updated_at,
        archived_at=getattr(space, "archived_at", None),
        reopen_until=getattr(space, "reopen_until", None),
        can_reopen=_can_reopen_space(space),
        deleted_at=space.deleted_at,
    )


def _space_member_response(member: SpaceMember) -> SpaceMemberResponse:
    return SpaceMemberResponse(
        space_member_id=member.space_member_id,
        space_id=member.space_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        status=member.status,
        removed_at=member.removed_at,
        user=UserSummaryResponse.model_validate(member.user) if member.user else None,
    )


def _space_member_request_response(request: SpaceMemberRequest) -> SpaceMemberRequestResponse:
    return SpaceMemberRequestResponse.model_validate(request)


def _ensure_space_active(space: Space) -> None:
    if space.status_space == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is archived",
        )
    if space.status_space != "Active" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space must be active",
        )


def _normalize_email_value(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip().lower()


def _resolve_requested_user(db: Session, payload: SpaceAddPeopleRequest) -> User | None:
    if payload.user_id:
        return db.query(User).filter(User.user_id == payload.user_id).first()
    if payload.email:
        email = _normalize_email_value(payload.email)
        return db.query(User).filter(func.lower(User.email) == email).first()
    if payload.name:
        return (
            db.query(User)
            .filter(func.lower(func.trim(User.full_name)) == payload.name.strip().lower())
            .first()
        )
    return None


def _ensure_user_can_join(user: User) -> None:
    if user.status_user != "Active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not active",
        )
    if user.locked_until is not None and user.locked_until > vietnam_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is locked",
        )


def _get_space_member(db: Session, space_id: str, user_id: str) -> SpaceMember | None:
    return (
        db.query(SpaceMember)
        .filter(SpaceMember.space_id == space_id, SpaceMember.user_id == user_id)
        .first()
    )


def _add_or_restore_space_member(db: Session, space: Space, user: User) -> SpaceMember:
    existing_member = _get_space_member(db, space.space_id, user.user_id)
    if existing_member and existing_member.status == "Active" and existing_member.removed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already an active member",
        )

    now = vietnam_now()
    role = "OWNER" if space.owner_id == user.user_id else "MEMBER"

    if existing_member:
        existing_member.role = role
        existing_member.status = "Active"
        existing_member.removed_at = None
        existing_member.joined_at = now
        existing_member.user = user
        return existing_member

    member = SpaceMember(
        space_id=space.space_id,
        user_id=user.user_id,
        role=role,
        status="Active",
        joined_at=now,
    )
    member.user = user
    db.add(member)
    return member


def _pending_member_request_exists(
    db: Session,
    *,
    space_id: str,
    requested_user_id: str | None,
    requested_email: str,
) -> bool:
    query = db.query(SpaceMemberRequest).filter(
        SpaceMemberRequest.space_id == space_id,
        SpaceMemberRequest.status.in_(["PENDING_OWNER", "PENDING_INVITEE"]),
    )
    if requested_user_id:
        query = query.filter(
            (SpaceMemberRequest.requested_user_id == requested_user_id)
            | (func.lower(SpaceMemberRequest.requested_email) == requested_email)
        )
    else:
        query = query.filter(func.lower(SpaceMemberRequest.requested_email) == requested_email)
    return query.first() is not None


def _api_public_base_url() -> str:
    return (
        os.getenv("API_PUBLIC_URL")
        or os.getenv("BACKEND_PUBLIC_URL")
        or os.getenv("BACKEND_URL")
        or "http://localhost:8000"
    ).rstrip("/")


def _frontend_space_tasks_url(space_id: str) -> str:
    frontend_url = (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")
    return f"{frontend_url}/dashboard/tasks/{space_id}"


def _send_member_request_email(
    *,
    owner: User,
    requester: User,
    space: Space,
    request: SpaceMemberRequest,
) -> bool:
    safe_space_name = html.escape(space.name_space)
    safe_requester_name = html.escape(requester.full_name)
    safe_requester_email = html.escape(requester.email)
    safe_owner_email = html.escape(owner.email)
    safe_requested_name = html.escape(request.requested_name or request.requested_email)
    safe_requested_email = html.escape(request.requested_email)
    base_url = _api_public_base_url()
    approve_url = f"{base_url}/api/v1/spaces/member-requests/{request.review_token}/approve"
    reject_url = f"{base_url}/api/v1/spaces/member-requests/{request.review_token}/reject"

    text_content = (
        "TaskFlow\n\n"
        f"{requester.full_name} ({requester.email}) requested your approval before inviting "
        f"{request.requested_name or request.requested_email} ({request.requested_email}) "
        f"to {space.name_space}.\n\n"
        f"Owner: {owner.email}\n"
        f"Requested by: {requester.email}\n"
        f"Invitee: {request.requested_email}\n\n"
        f"Approve: {approve_url}\n"
        f"Reject: {reject_url}\n\n"
        "If you did not expect this request, reject it or ignore this email."
    )
    html_content = f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:18px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #E0D7F0;border-radius:14px;overflow:hidden;box-shadow:0 16px 42px rgba(76,43,116,0.14);">
            <tr>
              <td style="padding:14px 28px 15px;background:#4C2B74;color:#ffffff;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#EADFF9;">TaskFlow</div>
                <div style="font-size:20px;font-weight:800;margin-top:5px;">Review member request</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 24px;">
                <span style="display:inline-block;background:#F0EDFF;color:#4C2B74;font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;">Owner approval needed</span>
                <h1 style="margin:14px 0 8px;font-size:20px;color:#0f172a;">Approve this invitation?</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#334155;">
                  <strong>{safe_requester_name}</strong>
                  <span style="color:#64748b;">({safe_requester_email})</span>
                  wants to invite <strong>{safe_requested_name}</strong>
                  to <strong>{safe_space_name}</strong>.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E0D7F0;border-radius:10px;background:#FAF8FF;margin-bottom:18px;overflow:hidden;">
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;border-bottom:1px solid #E0D7F0;width:130px;">Space</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;border-bottom:1px solid #E0D7F0;">{safe_space_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;border-bottom:1px solid #E0D7F0;">Owner email</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;border-bottom:1px solid #E0D7F0;">{safe_owner_email}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;border-bottom:1px solid #E0D7F0;">Requested by</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;border-bottom:1px solid #E0D7F0;">{safe_requester_email}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;">Invitee email</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;">{safe_requested_email}</td>
                  </tr>
                </table>
                <a href="{html.escape(approve_url)}" style="display:inline-block;background:#6B4A91;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:11px 17px;border-radius:9px;margin-right:10px;">Approve and send invite</a>
                <a href="{html.escape(reject_url)}" style="display:inline-block;background:#ffffff;color:#b91c1c;text-decoration:none;font-weight:800;font-size:13px;padding:10px 16px;border:1px solid #fecaca;border-radius:9px;">Reject</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    return get_email_service().send_email(
        to_email=owner.email,
        subject=f"TaskFlow: Approve member for {space.name_space}",
        text_content=text_content,
        html_content=html_content,
    )


def _send_member_invitation_email(
    *,
    inviter: User,
    space: Space,
    request: SpaceMemberRequest,
) -> bool:
    safe_space_name = html.escape(space.name_space)
    safe_inviter_name = html.escape(inviter.full_name)
    safe_inviter_email = html.escape(inviter.email)
    safe_requested_name = html.escape(request.requested_name or request.requested_email)
    safe_requested_email = html.escape(request.requested_email)
    base_url = _api_public_base_url()
    accept_url = f"{base_url}/api/v1/spaces/member-requests/{request.review_token}/approve"
    decline_url = f"{base_url}/api/v1/spaces/member-requests/{request.review_token}/reject"

    text_content = (
        "TaskFlow\n\n"
        f"{inviter.full_name} ({inviter.email}) invited you to join {space.name_space}.\n\n"
        f"Accept invitation: {accept_url}\n"
        f"Decline invitation: {decline_url}\n\n"
        f"This invitation was sent to {request.requested_email}."
    )
    html_content = f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:18px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #E2D8EE;border-radius:14px;overflow:hidden;box-shadow:0 14px 34px rgba(76,43,116,0.12);">
            <tr>
              <td style="padding:14px 28px 15px;background:#5B3A7A;color:#ffffff;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#EADFF9;">TaskFlow invitation</div>
                <div style="font-size:20px;font-weight:800;margin-top:5px;">You're invited to collaborate</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 24px;">
                <span style="display:inline-block;background:#F0EDFF;color:#5B3A7A;font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;">Waiting for your acceptance</span>
                <h1 style="margin:14px 0 8px;font-size:20px;color:#0f172a;font-weight:400;">Join <strong style="font-weight:700;">{safe_space_name}</strong></h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#334155;">
                  Hi <strong>{safe_requested_name}</strong>, <strong>{safe_inviter_name}</strong>
                  <span style="color:#64748b;">({safe_inviter_email})</span>
                  invited you to join <strong>{safe_space_name}</strong> on TaskFlow.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2D8EE;border-radius:10px;background:#FAF8FF;margin-bottom:18px;overflow:hidden;">
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;border-bottom:1px solid #E2D8EE;width:130px;">Workspace</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;border-bottom:1px solid #E2D8EE;">{safe_space_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;border-bottom:1px solid #E2D8EE;">Invited by</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;border-bottom:1px solid #E2D8EE;">{safe_inviter_email}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;color:#6E5A8A;font-size:12px;font-weight:700;">Sent to</td>
                    <td style="padding:10px 14px;color:#1f2937;font-size:13px;">{safe_requested_email}</td>
                  </tr>
                </table>
                <a href="{html.escape(accept_url)}" style="display:inline-block;background:#6B4A91;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:11px 17px;border-radius:9px;margin-right:10px;">Accept invitation</a>
                <a href="{html.escape(decline_url)}" style="display:inline-block;background:#ffffff;color:#5B3A7A;text-decoration:none;font-weight:800;font-size:13px;padding:10px 16px;border:1px solid #E2D8EE;border-radius:9px;">Decline</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    return get_email_service().send_email(
        to_email=request.requested_email,
        subject=f"TaskFlow: Invitation to join {space.name_space}",
        text_content=text_content,
        html_content=html_content,
    )


def _notify_inviter_invitation_accepted(
    db: Session,
    *,
    space: Space,
    request: SpaceMemberRequest,
    invitee: User | None,
) -> None:
    invitee_name = (
        invitee.full_name
        if invitee is not None
        else request.requested_name
        or request.requested_email
    )
    message = f"{invitee_name} accepted your invitation to join {space.name_space}."

    recipient_ids = [request.requester_id]
    owner_id = getattr(request, "owner_id", None)

    if owner_id:
        recipient_ids.append(owner_id)

    for recipient_id in dict.fromkeys(recipient_ids):
        recipient = db.query(User).filter(User.user_id == recipient_id).first()
        if recipient is None:
            continue

        notification_service.create_notification(
            db,
            user_id=recipient.user_id,
            actor_id=invitee.user_id if invitee is not None else None,
            space_id=space.space_id,
            notification_type="space_member_added",
            title="Invitation accepted",
            message=message,
            audience="USER",
            metadata={
                "space_name": space.name_space,
                "invitee_email": request.requested_email,
                "event": "space_invitation_accepted",
                "action_url": _frontend_space_tasks_url(space.space_id),
            },
            allow_self_notification=True,
        )


def get_space_or_404(db: Session, space_id: str) -> Space:
    space = db.query(Space).filter(Space.space_id == space_id).first()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found",
        )
    return space


def create_space(db: Session, payload: SpaceCreate) -> SpaceResponse:
    owner = db.query(User).filter(User.user_id == payload.owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )
    _ensure_active_owner(owner)

    name_space = _normalize_space_name(payload.name_space)
    _ensure_space_name_available(
        db,
        owner_id=payload.owner_id,
        name_space=name_space,
    )

    space = Space(
        name_space=name_space,
        description=payload.description,
        owner_id=payload.owner_id,
        status_space="Active",
    )
    db.add(space)
    db.flush()

    db.add(
        SpaceMember(
            space_id=space.space_id,
            user_id=payload.owner_id,
            role="OWNER",
            status="Active",
        )
    )
    notification_service.create_notification(
        db,
        user_id=payload.owner_id,
        notification_type="space_created",
        title="Space created",
        message=f"Space {space.name_space} was created.",
        space_id=space.space_id,
        audience="USER",
        metadata={"space_name": space.name_space},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space)


def list_spaces(db: Session, include_deleted: bool = False, current_user: User | None = None) -> List[SpaceResponse]:
    query = db.query(Space).order_by(Space.created_at.desc())
    if not include_deleted:
        query = query.filter(Space.deleted_at.is_(None), Space.status_space != "Deleted")
    if current_user is not None and current_user.role != "SUPER_ADMIN":
        query = (
            query.outerjoin(
                SpaceMember,
                (SpaceMember.space_id == Space.space_id)
                & (SpaceMember.user_id == current_user.user_id)
                & (SpaceMember.status == "Active")
                & (SpaceMember.removed_at.is_(None)),
            )
            .filter((Space.owner_id == current_user.user_id) | (SpaceMember.space_member_id.isnot(None)))
            .distinct()
        )
    spaces = query.all()
    task_counts = _active_task_counts_for_spaces(db, [space.space_id for space in spaces])
    return [_space_response(space, task_count=task_counts.get(space.space_id, 0)) for space in spaces]


def list_owner_trash(db: Session, owner_id: str, current_user: User | None = None) -> List[SpaceResponse]:
    if current_user is not None and current_user.role != "SUPER_ADMIN" and owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )

    owner = db.query(User).filter(User.user_id == owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )

    trash_cutoff = vietnam_now() - timedelta(days=TRASH_RETENTION_DAYS)
    spaces = (
        db.query(Space)
        .filter(
            Space.owner_id == owner_id,
            Space.status_space == "Deleted",
            Space.deleted_at.isnot(None),
            Space.deleted_at > trash_cutoff,
        )
        .order_by(Space.deleted_at.desc())
        .all()
    )
    task_counts = _active_task_counts_for_spaces(db, [space.space_id for space in spaces])
    return [_space_response(space, task_count=task_counts.get(space.space_id, 0)) for space in spaces]


def get_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_can_view_space(db, space, current_user)
    return _space_response(space, task_count=_active_task_count_for_space(db, space.space_id))


def update_space(db: Session, space_id: str, payload: SpaceUpdate, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    _ensure_space_mutable(space)

    if hasattr(payload, "model_dump"):
        update_data = payload.model_dump(exclude_unset=True)
    else:
        update_data = payload.dict(exclude_unset=True)

    if "name_space" in update_data:
        update_data["name_space"] = _normalize_space_name(update_data["name_space"])
        _ensure_space_name_available(
            db,
            owner_id=space.owner_id,
            name_space=update_data["name_space"],
            exclude_space_id=space.space_id,
        )

    for field, value in update_data.items():
        setattr(space, field, value)

    space.updated_at = vietnam_now()
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="space_updated",
        title="Space updated",
        message=f"Space {space.name_space} was updated.",
        space_id=space.space_id,
        audience="USER",
        metadata={"space_name": space.name_space, "updated_fields": sorted(update_data)},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space, task_count=_active_task_count_for_space(db, space.space_id))


def archive_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    if space.status_space == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is already archived",
        )
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot archive deleted space",
        )
    _ensure_space_completion_requirements(db, space.space_id)

    now = vietnam_now()
    space.status_space = "Archived"
    space.archived_at = now
    space.reopen_until = _space_reopen_until(now)
    space.updated_at = now
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space archived",
        message=f"Space {space.name_space} was archived.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_archived"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space, task_count=_active_task_count_for_space(db, space.space_id))


def unarchive_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    if space.status_space == "Active" and space.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is already active",
        )
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unarchive deleted space",
        )
    if space.status_space != "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space must be archived",
        )
    if not _can_reopen_space(space):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space reopen period has expired",
        )

    owner = db.query(User).filter(User.user_id == space.owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )
    _ensure_active_owner(owner)
    _ensure_space_name_available(
        db,
        owner_id=space.owner_id,
        name_space=space.name_space,
        exclude_space_id=space.space_id,
    )

    space.status_space = "Active"
    space.archived_at = None
    space.reopen_until = None
    space.updated_at = vietnam_now()
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space reopened",
        message=f"Space {space.name_space} was reopened.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_unarchived"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space, task_count=_active_task_count_for_space(db, space.space_id))


def restore_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    if space.status_space != "Deleted" or space.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is not deleted",
        )
    if _is_trash_expired(space):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space restore period has expired",
        )
    owner = db.query(User).filter(User.user_id == space.owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )
    _ensure_active_owner(owner)
    _ensure_space_name_available(
        db,
        owner_id=space.owner_id,
        name_space=space.name_space,
        exclude_space_id=space.space_id,
    )

    space.status_space = "Active"
    space.archived_at = None
    space.reopen_until = None
    space.deleted_at = None
    space.updated_at = vietnam_now()
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space restored",
        message=f"Space {space.name_space} was restored.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_restored"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space, task_count=_active_task_count_for_space(db, space.space_id))


def delete_space(db: Session, space_id: str, current_user: User | None = None) -> SpaceResponse:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_space_owner(space, current_user)
    _ensure_space_can_be_deleted(space)
    now = vietnam_now()
    space.status_space = "Deleted"
    space.deleted_at = now
    space.reopen_until = None
    space.updated_at = now
    notification_service.create_notification(
        db,
        user_id=space.owner_id,
        notification_type="owner_space_update",
        title="Space deleted",
        message=f"Space {space.name_space} was moved to trash.",
        space_id=space.space_id,
        audience="OWNER",
        metadata={"space_name": space.name_space, "event": "space_deleted"},
        allow_self_notification=True,
    )
    db.commit()
    db.refresh(space)
    return _space_response(space, task_count=_active_task_count_for_space(db, space.space_id))


def list_expired_deleted_space_records(db: Session, *, now: datetime | None = None) -> list[Space]:
    cutoff = (now or vietnam_now()) - timedelta(days=TRASH_RETENTION_DAYS)
    return (
        db.query(Space)
        .filter(
            Space.status_space == "Deleted",
            Space.deleted_at.isnot(None),
            Space.deleted_at <= cutoff,
        )
        .order_by(Space.deleted_at.asc(), Space.space_id.asc())
        .all()
    )


def hard_delete_space(db: Session, space_id: str, *, commit: bool = True) -> bool:
    space = db.query(Space).filter(Space.space_id == space_id).first()
    if not space:
        return False

    task_ids = [task_id for (task_id,) in db.query(Task.task_id).filter(Task.space_id == space_id).all()]

    if task_ids:
        db.query(RecentView).filter(
            RecentView.entity_type == "task",
            RecentView.entity_id.in_(task_ids),
        ).delete(synchronize_session=False)
        db.query(Notification).filter(
            or_(Notification.task_id.in_(task_ids), Notification.space_id == space_id)
        ).delete(synchronize_session=False)
        db.query(TaskComment).filter(TaskComment.task_id.in_(task_ids)).update(
            {TaskComment.parent_comment_id: None},
            synchronize_session=False,
        )
        db.query(TaskComment).filter(TaskComment.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(TaskAttachment).filter(TaskAttachment.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(TaskAssignee).filter(TaskAssignee.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(TaskAssignmentHistory).filter(TaskAssignmentHistory.task_id.in_(task_ids)).delete(
            synchronize_session=False
        )
        db.query(Task).filter(Task.task_id.in_(task_ids)).delete(synchronize_session=False)
    else:
        db.query(Notification).filter(Notification.space_id == space_id).delete(synchronize_session=False)

    db.query(RecentView).filter(
        RecentView.entity_type == "space",
        RecentView.entity_id == space_id,
    ).delete(synchronize_session=False)
    db.query(SpaceMemberRequest).filter(SpaceMemberRequest.space_id == space_id).delete(synchronize_session=False)
    db.query(SpaceMember).filter(SpaceMember.space_id == space_id).delete(synchronize_session=False)
    db.query(Sprint).filter(Sprint.space_id == space_id).delete(synchronize_session=False)
    db.query(Space).filter(Space.space_id == space_id).delete(synchronize_session=False)

    if commit:
        db.commit()
    return True


def cleanup_expired_deleted_spaces(db: Session, *, now: datetime | None = None) -> int:
    expired_spaces = list_expired_deleted_space_records(db, now=now)
    deleted_count = 0

    try:
        for space in expired_spaces:
            if hard_delete_space(db, space.space_id, commit=False):
                deleted_count += 1
        if deleted_count:
            db.commit()
    except Exception:
        db.rollback()
        raise

    return deleted_count


def list_expired_archived_space_reopen_records(db: Session, *, now: datetime | None = None) -> list[Space]:
    current_time = now or vietnam_now()
    return (
        db.query(Space)
        .filter(
            Space.status_space == "Archived",
            Space.deleted_at.is_(None),
            Space.reopen_until.isnot(None),
            Space.reopen_until <= current_time,
        )
        .order_by(Space.reopen_until.asc(), Space.space_id.asc())
        .all()
    )


def cleanup_expired_archived_space_reopen_windows(db: Session, *, now: datetime | None = None) -> int:
    expired_spaces = list_expired_archived_space_reopen_records(db, now=now)
    expired_count = 0

    try:
        for space in expired_spaces:
            space.reopen_until = None
            space.updated_at = now or vietnam_now()
            expired_count += 1
        if expired_count:
            db.commit()
    except Exception:
        db.rollback()
        raise

    return expired_count


def list_space_members(db: Session, space_id: str, current_user: User | None = None) -> List[SpaceMemberResponse]:
    space = get_space_or_404(db, space_id)
    if current_user is not None:
        _ensure_can_view_space(db, space, current_user)
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is deleted",
        )

    members = (
        db.query(SpaceMember)
        .filter(SpaceMember.space_id == space_id)
        .order_by(SpaceMember.joined_at.asc())
        .all()
    )
    return [_space_member_response(member) for member in members]


def list_pending_space_member_requests(
    db: Session,
    space_id: str,
    current_user: User,
) -> List[SpaceMemberRequestResponse]:
    space = get_space_or_404(db, space_id)
    _ensure_space_active(space)
    _ensure_can_request_space_people(current_user)
    _ensure_can_view_space(db, space, current_user)

    query = (
        db.query(SpaceMemberRequest)
        .filter(
            SpaceMemberRequest.space_id == space_id,
            SpaceMemberRequest.status.in_(["PENDING_OWNER", "PENDING_INVITEE"]),
        )
    )

    if space.owner_id != current_user.user_id:
        query = query.filter(
            or_(
                SpaceMemberRequest.requester_id == current_user.user_id,
                SpaceMemberRequest.requested_user_id == current_user.user_id,
            )
        )

    requests = query.order_by(SpaceMemberRequest.requested_at.desc()).all()
    return [_space_member_request_response(request) for request in requests]


def add_people_to_space(
    db: Session,
    space_id: str,
    payload: SpaceAddPeopleRequest,
    current_user: User,
) -> SpaceAddPeopleResponse:
    space = get_space_or_404(db, space_id)
    _ensure_space_active(space)
    _ensure_can_request_space_people(current_user)
    _ensure_can_view_space(db, space, current_user)

    requested_user = _resolve_requested_user(db, payload)
    requested_email = _normalize_email_value(payload.email) if payload.email else None

    if requested_user:
        _ensure_user_can_join(requested_user)
        requested_email = requested_user.email.strip().lower()
    elif payload.user_id or (payload.name and not payload.email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not requested_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required when the user account cannot be resolved",
        )

    if requested_user and requested_user.user_id == space.owner_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already the space owner",
        )

    if requested_user and _get_space_member(db, space.space_id, requested_user.user_id):
        active_member = _is_active_space_member(db, space.space_id, requested_user.user_id)
        if active_member:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already an active member",
            )

    if _pending_member_request_exists(
        db,
        space_id=space.space_id,
        requested_user_id=requested_user.user_id if requested_user else None,
        requested_email=requested_email,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending approval request already exists for this person",
        )

    is_owner_invite = space.owner_id == current_user.user_id
    owner = db.query(User).filter(User.user_id == space.owner_id).first()
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner user not found",
        )

    request_status = "PENDING_INVITEE" if is_owner_invite else "PENDING_OWNER"
    requested_name = (
        requested_user.full_name
        if requested_user
        else payload.name
        or requested_email.split("@", 1)[0]
    )
    member_request = SpaceMemberRequest(
        space_id=space.space_id,
        requester_id=current_user.user_id,
        requested_user_id=requested_user.user_id if requested_user else None,
        requested_email=requested_email,
        requested_name=requested_name,
        owner_id=space.owner_id,
        status=request_status,
        review_token=secrets.token_urlsafe(32),
        requested_at=vietnam_now(),
    )
    member_request.requester = current_user
    member_request.requested_user = requested_user
    member_request.owner = owner
    db.add(member_request)
    db.flush()

    if is_owner_invite:
        email_sent = _send_member_invitation_email(
            inviter=current_user,
            space=space,
            request=member_request,
        )
        message = "Invitation email sent. Waiting for the invitee to accept."
    else:
        email_sent = _send_member_request_email(
            owner=owner,
            requester=current_user,
            space=space,
            request=member_request,
        )
        message = "Approval request sent to the space owner."

    db.commit()
    db.refresh(member_request)
    member_request.requester = current_user
    member_request.requested_user = requested_user
    member_request.owner = owner

    if not email_sent:
        message = "Request created, but email delivery is not configured or failed."

    return SpaceAddPeopleResponse(
        status=request_status,
        message=message,
        request=_space_member_request_response(member_request),
    )


def review_space_member_request(
    db: Session,
    review_token: str,
    *,
    approve: bool,
) -> str:
    member_request = (
        db.query(SpaceMemberRequest)
        .filter(SpaceMemberRequest.review_token == review_token)
        .first()
    )
    if member_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found",
        )
    if member_request.status not in ("PENDING_OWNER", "PENDING_INVITEE"):
        return f"Request was already {member_request.status.lower()}."

    member_request.reviewed_at = vietnam_now()
    if not approve:
        member_request.status = "REJECTED"
        db.commit()
        return "Request rejected."

    space = get_space_or_404(db, member_request.space_id)
    _ensure_space_active(space)

    if member_request.status == "PENDING_OWNER":
        owner = db.query(User).filter(User.user_id == member_request.owner_id).first()
        if owner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owner user not found",
            )
        requester = db.query(User).filter(User.user_id == member_request.requester_id).first()
        if requester is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requester user not found",
            )
        member_request.status = "PENDING_INVITEE"
        member_request.review_token = secrets.token_urlsafe(32)
        email_sent = _send_member_invitation_email(
            inviter=requester,
            space=space,
            request=member_request,
        )
        db.commit()
        if not email_sent:
            return "Owner approved, but invitation email delivery failed."
        return "Owner approved. Invitation email sent to the invitee."

    user = None
    if member_request.requested_user_id:
        user = db.query(User).filter(User.user_id == member_request.requested_user_id).first()
    if user is None:
        user = (
            db.query(User)
            .filter(func.lower(User.email) == member_request.requested_email.strip().lower())
            .first()
        )

    member = None
    if user is not None:
        _ensure_user_can_join(user)
        member_request.requested_user_id = user.user_id
        existing_member = _get_space_member(db, space.space_id, user.user_id)
        if existing_member and existing_member.status == "Active" and existing_member.removed_at is None:
            member = existing_member
        else:
            member = _add_or_restore_space_member(db, space, user)
        notification_service.create_notification(
            db,
            user_id=user.user_id,
            actor_id=member_request.owner_id,
            space_id=space.space_id,
            notification_type="space_member_added",
            title="Added to space",
            message=f"You were added to {space.name_space}.",
            audience="USER",
            metadata={"space_name": space.name_space},
        )
        _notify_inviter_invitation_accepted(
            db,
            space=space,
            request=member_request,
            invitee=user,
        )

    member_request.status = "APPROVED"
    if user is None:
        _notify_inviter_invitation_accepted(
            db,
            space=space,
            request=member_request,
            invitee=None,
        )
    db.commit()
    if member is not None:
        db.refresh(member)
        return "Invitation accepted and member added."
    return "Invitation accepted. Register with this email to access the space."
