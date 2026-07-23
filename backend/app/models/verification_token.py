from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, Text, UniqueConstraint, func

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class VerificationToken(Base):
    __tablename__ = "verification_token"

    token_id = prefixed_id_column("VTK", "verification_token_token_id_seq")
    email = Column(String(255), nullable=False)
    otp_code = Column(Text, nullable=False)
    token_type = Column(String(30), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    resend_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "token_type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')",
            name="check_verification_token_token_type",
        ),
        CheckConstraint(
            "(token_type = 'EMAIL_VERIFICATION' AND otp_code ~ '^[0-9]{6}$') "
            "OR (token_type = 'PASSWORD_RESET' "
            "AND otp_code ~ '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$')",
            name="check_verification_token_otp_code",
        ),
        UniqueConstraint("email", "token_type", name="uq_verification_token_email_token_type"),
    )
