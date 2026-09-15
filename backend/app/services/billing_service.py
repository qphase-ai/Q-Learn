import hashlib
import hmac
import json
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.billing import SubscriptionPlan, UserSubscription, BillingEvent
from app.models.user import User
from app.schemas.billing import CheckoutData, SubscriptionDetail, PlanResponse
from app.exceptions import NotFoundError, ValidationError
from app.config import Settings


class BillingService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def list_plans(self) -> list[PlanResponse]:
        result = await self.db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.is_active == True)
        )
        return [PlanResponse.model_validate(p) for p in result.scalars().all()]

    async def create_subscription(self, user_id: uuid.UUID, plan_id: uuid.UUID) -> CheckoutData:
        plan = await self.db.get(SubscriptionPlan, plan_id)
        if not plan or not plan.razorpay_plan_id:
            raise NotFoundError("Plan not found or not a paid plan")

        import razorpay
        client = razorpay.Client(auth=(self.settings.razorpay_key_id, self.settings.razorpay_key_secret))

        subscription = client.subscription.create({
            "plan_id": plan.razorpay_plan_id,
            "total_count": 12,
            "quantity": 1,
        })

        sub = UserSubscription(
            user_id=user_id,
            plan_id=plan_id,
            razorpay_subscription_id=subscription["id"],
            status="pending",
        )
        self.db.add(sub)
        await self.db.commit()

        return CheckoutData(
            subscription_id=subscription["id"],
            razorpay_key=self.settings.razorpay_key_id,
            plan_name=plan.name,
            amount=plan.price_inr,
        )

    async def get_subscription(self, user_id: uuid.UUID) -> SubscriptionDetail:
        result = await self.db.execute(
            select(UserSubscription).where(UserSubscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return SubscriptionDetail(status="free", plan=None, current_period_end=None)

        plan = await self.db.get(SubscriptionPlan, sub.plan_id)
        return SubscriptionDetail(
            status=sub.status,
            plan=PlanResponse.model_validate(plan) if plan else None,
            current_period_end=sub.current_period_end,
        )

    async def handle_webhook(self, payload: bytes, signature: str) -> None:
        self._verify_signature(payload, signature)

        event = json.loads(payload)
        event_id = event.get("id", "")
        event_type = event.get("event", "")
        entity = event.get("payload", {}).get("subscription", {}).get("entity", {})
        razorpay_sub_id = entity.get("id")

        # Idempotency check
        existing = await self.db.execute(
            select(BillingEvent).where(BillingEvent.razorpay_event_id == event_id)
        )
        if existing.scalar_one_or_none():
            return

        result = await self.db.execute(
            select(UserSubscription).where(UserSubscription.razorpay_subscription_id == razorpay_sub_id)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            return

        if event_type == "subscription.activated":
            sub.status = "active"
            await self._set_subscription_status(sub.user_id, "pro")

        elif event_type == "subscription.charged":
            sub.status = "active"

        elif event_type == "subscription.cancelled":
            sub.status = "cancelled"
            # Keep pro until period end — downgrade happens at current_period_end via cron

        elif event_type == "subscription.halted":
            sub.status = "halted"

        billing_event = BillingEvent(
            user_id=sub.user_id,
            event_type=event_type.split(".")[-1],
            razorpay_event_id=event_id,
            payload=event,
        )
        self.db.add(billing_event)
        await self.db.commit()

    async def _set_subscription_status(self, user_id: uuid.UUID, status: str) -> None:
        user = await self.db.get(User, user_id)
        if user:
            user.subscription_status = status
            await self.db.commit()

    def _verify_signature(self, payload: bytes, signature: str) -> None:
        expected = hmac.new(
            self.settings.razorpay_webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValidationError("Invalid webhook signature")
