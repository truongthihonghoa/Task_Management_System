from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class SpaceMemberRequest(Base):
    __tablename__ = "space_member_requests"

    space_member_request_id = prefixed_id_column(
        "SMR",
        "space_member_requests_space_member_request_id_seq",
        unique=True,
    )
    space_id = Column(String(15), ForeignKey("spaces.space_id"), nullable=False)
    requester_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    requested_user_id = Column(String(15), ForeignKey("users.user_id"), nullable=True)
    requested_email = Column(String(255), nullable=False)
    requested_name = Column(String(100), nullable=True)
    owner_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING_OWNER", server_default="PENDING_OWNER")
    review_token = Column(Text, nullable=False, unique=True)
    requested_at = Column(DateTime, nullable=False, server_default=func.now())
    reviewed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING_OWNER', 'PENDING_INVITEE', 'APPROVED', 'REJECTED')",
            name="check_space_member_requests_status",
        ),
    )

    space = relationship("Space")
    requester = relationship("User", foreign_keys=[requester_id])
    requested_user = relationship("User", foreign_keys=[requested_user_id])
    owner = relationship("User", foreign_keys=[owner_id])
