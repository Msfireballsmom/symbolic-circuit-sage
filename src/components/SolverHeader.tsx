import { Zap, LogOut, Crown, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SolveCounter from "@/components/SolveCounter";
import { TIERS, TierKey } from "@/lib/tier-config";

const TIER_LABELS: Record<string, string> = {
  basic: "BASIC",
  student: "STUDENT",
  pro: "PRO",
  team: "TEAM",
};

const SolverHeader = () => {
  const { user, profile, subscription, signOut } = useAuth();
  const navigate = useNavigate();

  const tier = subscription?.tier;
  const tierLabel = tier ? TIER_LABELS[tier] || tier.toUpperCase() : "FREE";
  const hasPaid = !!tier;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Circuit <span className="text-primary glow-text">Sage</span>
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Advanced Analysis Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
            Engine Ready
          </div>

          <SolveCounter />

          {user && (
            <div className="flex items-center gap-2">
              {hasPaid ? (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/30 text-primary text-[10px] font-semibold">
                  <Crown className="w-3 h-3" /> {tierLabel}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                  onClick={() => navigate("/pricing")}
                >
                  <Crown className="w-3 h-3" /> Upgrade
                </Button>
              )}
              <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[120px]">
                {profile?.full_name || profile?.email}
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={signOut}>
                <LogOut className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default SolverHeader;
