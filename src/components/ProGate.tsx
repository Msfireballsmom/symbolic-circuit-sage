import { useAuth } from "@/hooks/useAuth";
import { Crown, Lock } from "lucide-react";
import { ReactNode } from "react";
import { AUTH_ENABLED } from "@/lib/feature-flags";

interface ProGateProps {
  children: ReactNode;
  featureName: string;
}

const ProGate = ({ children, featureName }: ProGateProps) => {
  const { isPro, user } = useAuth();
  if (!AUTH_ENABLED) return <>{children}</>;

  // If not logged in at all, show the content (handled by auth page)
  if (!user) return <>{children}</>;

  // Pro users see everything
  if (isPro) return <>{children}</>;

  // Free users see the gate
  return (
    <div className="p-8 rounded-xl bg-card border border-border text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
        <Lock className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground">{featureName}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        This feature is available with a <span className="text-primary font-semibold">Pro subscription</span>. 
        Upgrade to unlock all solvers, Snap & Solve, and practice exams.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold">
        <Crown className="w-4 h-4" />
        Upgrade to Pro — $9.99/mo
      </div>
      <div className="text-[10px] text-muted-foreground">
        Free tier includes: Quick Solve, Voltage Divider, Reference Sheet
      </div>
    </div>
  );
};

export default ProGate;
