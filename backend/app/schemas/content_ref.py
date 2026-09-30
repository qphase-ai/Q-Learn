import uuid

from pydantic import BaseModel, Field

from app.models.content_ref import ContentKind


class RegisterContentRefRequest(BaseModel):
    kind: ContentKind
    payload_id: str = Field(min_length=1, max_length=255)
    # Set when the CMS document already carries a ref id (legacy import).
    ref_id: uuid.UUID | None = None


class ContentRefOut(BaseModel):
    id: uuid.UUID
    kind: ContentKind
    payload_id: str

    model_config = {"from_attributes": True}
