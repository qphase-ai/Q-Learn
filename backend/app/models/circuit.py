from sqlalchemy import String, Text, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import func, DateTime
import uuid
from app.models.base import Base


class Circuit(Base):
    __tablename__ = "circuits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    circuit_json: Mapped[dict] = mapped_column(JSON, nullable=False)   # framework-independent spec
    qasm: Mapped[str | None] = mapped_column(Text)
    num_qubits: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    executions: Mapped[list["CircuitExecution"]] = relationship("CircuitExecution", back_populates="circuit")


class CircuitExecution(Base):
    __tablename__ = "circuit_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circuit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("circuits.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    shots: Mapped[int] = mapped_column(Integer, default=1024)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | running | completed | failed
    statevector: Mapped[list | None] = mapped_column(JSON)
    probabilities: Mapped[dict | None] = mapped_column(JSON)
    measurements: Mapped[dict | None] = mapped_column(JSON)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    executed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    circuit: Mapped["Circuit"] = relationship("Circuit", back_populates="executions")
