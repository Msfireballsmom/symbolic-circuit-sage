import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Crown, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { TierKey, TIERS, TAB_TIER_REQUIREMENTS, tierMeetsRequirement } from "@/lib/tier-config";

interface TierGateProps {
  children: ReactNode;
  tabId: string;
}

const TierGate = ({ children, tabId }: TierGateProps) => {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();

  // Guests and non-logged-in users see content (handled by auth page)
  if (!user) return <>{children}</>;

  const requiredTier = TAB_TIER_REQUIREMENTS[tabId];
  if (!requiredTier) return <>{children}</>;

  const userTier = subscription?.tier as TierKey | null;

  if (tierMeetsRequirement(userTier, requiredTier)) {
    return <>{children}</>;
  }

  const tier = TIERS[requiredTier];

  return (
    <div className="p-8 rounded-xl bg-card border border-border text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
        <Lock className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground">
        Requires {tier.name} Plan
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        This solver requires a <span className="text-primary font-semibold">{tier.name}</span> subscription or higher.
        Upgrade to unlock this and more.
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
