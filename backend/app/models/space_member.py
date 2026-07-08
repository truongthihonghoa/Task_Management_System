from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class SpaceMember(Base):
    __tablename__ = "space_members"

    space_member_id = prefixed_id_column("SPM", "space_members_space_member_id_seq", unique=True)
    space_id = Column(String(15), ForeignKey("spaces.space_id"), nullable=False)
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    role = Column(String(20), nullable=False)
    joined_at = Column(DateTime, nullable=False, server_default=func.now())
    status = Column(String(20), nullable=False, default="Active", server_default="Active")
    removed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint("role IN ('OWNER', 'MEMBER')", name="check_space_members_role"),
        CheckConstraint("status IN ('Active', 'Removed')", name="check_space_members_status"),
    )

    space = relationship("Space", back_populates="members")
    user = relationship("User", back_populates="space_memberships")
