import { Zap, LogOut, Crown, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const SolverHeader = () => {
  const { user, profile, isPro, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Circuit <span className="text-primary glow-text">Solver Pro</span>
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Advanced Analysis Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
            Engine Ready
          </div>

          {user && (
            <div className="flex items-center gap-2">
              {isPro ? (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/30 text-primary text-[10px] font-semibold">
                  <Crown className="w-3 h-3" /> PRO
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted border border-border text-muted-foreground text-[10px] font-semibold">
                  <User className="w-3 h-3" /> FREE
                </span>
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
