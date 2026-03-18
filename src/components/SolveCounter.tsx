import { Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TIERS, TierKey } from "@/lib/tier-config";

const SolveCounter = () => {
  const { subscription, dailySolves } = useAuth();

  const tier = subscription?.tier as TierKey | null;
  if (!tier) return null;

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
