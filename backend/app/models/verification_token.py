from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class VerificationToken(Base):
    __tablename__ = "verification_token"

    token_id = prefixed_id_column("VTK", "verification_token_token_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    token = Column(String(255), nullable=False, unique=True)
    token_type = Column(String(30), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "token_type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')",
            name="check_verification_token_token_type",
        ),
    )

    user = relationship("User", back_populates="verification_tokens")
