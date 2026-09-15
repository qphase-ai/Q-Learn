from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import get_settings, Settings
from app.dependencies import get_current_user
from app.schemas.billing import SubscribeRequest, CheckoutData, SubscriptionDetail, PlanResponse
from app.schemas.common import StandardResponse
from app.services.billing_service import BillingService

router = APIRouter()


@router.get("/plans", response_model=StandardResponse[list[PlanResponse]])
async def list_plans(
    db: AsyncSession = Depends(get_db),
):
    service = BillingService(db, get_settings())
    plans = await service.list_plans()
    return StandardResponse(data=plans)


@router.post("/subscribe", response_model=StandardResponse[CheckoutData])
async def subscribe(
    body: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user=Depends(get_current_user),
):
    service = BillingService(db, settings)
    checkout = await service.create_subscription(current_user.id, body.plan_id)
    return StandardResponse(data=checkout)


@router.get("/subscription", response_model=StandardResponse[SubscriptionDetail])
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user=Depends(get_current_user),
):
    service = BillingService(db, settings)
    detail = await service.get_subscription(current_user.id)
    return StandardResponse(data=detail)


@router.post("/webhook", include_in_schema=False)
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    service = BillingService(db, settings)
    await service.handle_webhook(payload, signature)
    return {"status": "ok"}
