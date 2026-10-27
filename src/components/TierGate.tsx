import { useAuth } from "@/hooks/useAuth";
import { useFreeRun } from "@/hooks/useFreeRun";
import { useNavigate } from "react-router-dom";
import { Crown, Lock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { TierKey, TIERS, TAB_TIER_REQUIREMENTS, tierMeetsRequirement } from "@/lib/tier-config";

interface TierGateProps {
  children: ReactNode;
  tabId: string;
}

const TierGate = ({ children, tabId }: TierGateProps) => {
  const { user, subscription } = useAuth();
  const { available: freeRunAvailable } = useFreeRun();
  const navigate = useNavigate();

  // Payments are not live yet: every solver is open to everyone until Stripe
  // launches. Re-enable the checks below when billing goes live.
  return <>{children}</>;

  // eslint-disable-next-line no-unreachable
  if (!user) return <>{children}</>;

  const requiredTier = TAB_TIER_REQUIREMENTS[tabId];
  if (!requiredTier) return <>{children}</>;

  const userTier = subscription?.tier as TierKey | null;

  if (tierMeetsRequirement(userTier, requiredTier)) {
    return <>{children}</>;
  }

  // One complete run each month, no subscription required. The meter is only
  // charged once a solve finishes, so nothing here is gated in advance.
  if (freeRunAvailable) {
    return (
      <div className="space-y-3">
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Your free run for this month is open. Solve, review every step, save and export it — the run is
            counted only after a solve finishes.
          </span>
        </div>
        {children}
      </div>
    );
  }

  const tier = TIERS[requiredTier];


  return (
    <div className="p-8 rounded-xl bg-card border border-border text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
        <Lock className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground">
        You have used your free run this month
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        A new free run opens next month. {tier.name} and above keep this solver open every day.
      </p>

      <Button onClick={() => navigate("/pricing")} className="gap-2">
        <Crown className="w-4 h-4" />
        View Plans
        <ArrowRight className="w-4 h-4" />
      </Button>
      <div className="text-[10px] text-muted-foreground">
        Starting at {TIERS.basic.price}/{TIERS.basic.interval}
      </div>
    </div>
  );
};

export default TierGate;
