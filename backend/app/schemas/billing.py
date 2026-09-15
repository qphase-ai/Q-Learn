from pydantic import BaseModel
import uuid
from datetime import datetime


class PlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    price_inr: int
    billing_cycle: str | None
    features: dict

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    plan_id: uuid.UUID


class CheckoutData(BaseModel):
    subscription_id: str
    razorpay_key: str
    plan_name: str
    amount: int


class SubscriptionDetail(BaseModel):
    status: str
    plan: PlanResponse | None
    current_period_end: datetime | None

    model_config = {"from_attributes": True}
