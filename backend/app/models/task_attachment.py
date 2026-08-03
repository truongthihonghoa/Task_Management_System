from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    attachment_id = prefixed_id_column("TAT", "task_attachments_attachment_id_seq")
    task_id = Column(String(32), ForeignKey("tasks.task_id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    storage_url = Column(Text, nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    uploaded_by = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime, nullable=True)

    task = relationship("Task", back_populates="attachments")
    uploader = relationship("User", back_populates="uploaded_attachments", foreign_keys=[uploaded_by])
