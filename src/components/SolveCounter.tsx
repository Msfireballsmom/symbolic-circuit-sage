import { Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFreeRun } from "@/hooks/useFreeRun";
import { TIERS, TierKey } from "@/lib/tier-config";

const SolveCounter = () => {
  const { user, subscription, dailySolves } = useAuth();
  const { available: freeRunAvailable } = useFreeRun();

  const tier = subscription?.tier as TierKey | null;

  if (!tier) {
    if (!user) return null;
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border text-[10px] font-mono">
        <Zap className={`w-3 h-3 ${freeRunAvailable ? "text-success" : "text-muted-foreground"}`} aria-hidden="true" />
        <span className={freeRunAvailable ? "text-foreground" : "text-muted-foreground"}>
          {freeRunAvailable ? "1 free run left this month" : "Free run used — resets next month"}
        </span>
      </div>
    );
  }

  const maxSolves = tier ? TIERS[tier]?.solvesPerDay : 0;
  if (!maxSolves || maxSolves === Infinity) return null;

  const used = dailySolves ?? 0;
  const remaining = Math.max(0, maxSolves - used);


  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border text-[10px] font-mono">
      <Zap className={`w-3 h-3 ${remaining > 0 ? "text-success" : "text-destructive"}`} />
      <span className={remaining > 0 ? "text-foreground" : "text-destructive"}>
        {remaining} of {maxSolves} solves left
      </span>
    </div>
  );
};

export default SolveCounter;
