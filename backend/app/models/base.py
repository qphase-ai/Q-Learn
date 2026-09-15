from sqlalchemy.orm import DeclarativeBase, mapped_column
from sqlalchemy import DateTime, func
from typing import Annotated
import uuid


class Base(DeclarativeBase):
    pass


# Reusable timestamp columns
timestamp = Annotated[
    DateTime,
    mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False),
]
