from pydantic import BaseModel
import uuid


# Sign-in / sign-up are handled by Supabase Auth on the client, so the API no
# longer defines request/token schemas for them — it only returns the profile.
class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    subscription_status: str
    is_active: bool
    is_verified: bool

    model_config = {"from_attributes": True}
