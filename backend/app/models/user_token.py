from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class UserToken(Base):
    __tablename__ = "user_tokens"

    token_id = prefixed_id_column("UTK", "user_tokens_token_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    access_expires_at = Column(DateTime, nullable=False)
    refresh_expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, nullable=True, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="tokens")
