import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Plan {
  id: string;
  name: string;
  price_inr: number;
  billing_cycle: string | null;
}

interface BillingStore {
  subscriptionStatus: "free" | "pro";
  currentPlan: Plan | null;
  isUpgradeModalOpen: boolean;
  triggerFeature: string | null;
  setSubscriptionStatus: (status: "free" | "pro") => void;
  openUpgradeModal: (feature: string) => void;
  closeUpgradeModal: () => void;
}

export const useBillingStore = create<BillingStore>()(
  persist(
    (set) => ({
      subscriptionStatus: "free",
      currentPlan: null,
      isUpgradeModalOpen: false,
      triggerFeature: null,
      setSubscriptionStatus: (status) => set({ subscriptionStatus: status }),
      openUpgradeModal: (feature) => set({ isUpgradeModalOpen: true, triggerFeature: feature }),
      closeUpgradeModal: () => set({ isUpgradeModalOpen: false, triggerFeature: null }),
    }),
    { name: "billing", partialize: (s) => ({ subscriptionStatus: s.subscriptionStatus, currentPlan: s.currentPlan }) }
  )
);
