import { useAuth } from "@/hooks/useAuth";
import { Crown, FlaskConical, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const TestModeBanner = () => {
  const { isTestMode, testTier, exitTestMode } = useAuth();

  if (!isTestMode) return null;

  const isPro = testTier === "pro";

  return (
    <div className={`sticky top-0 z-[60] px-4 py-2 flex items-center justify-between text-xs font-semibold ${
      isPro 
        ? "bg-primary/20 border-b border-primary/30 text-primary" 
        : "bg-accent/20 border-b border-accent/30 text-accent"
    }`}>
      <div className="flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5" />
        <span>TEST MODE</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-background/50">
          {isPro ? (
            <span className="flex items-center gap-1"><Crown className="w-3 h-3" /> Pro User</span>
          ) : (
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> Free User</span>
          )}
        </span>
        <span className="text-[10px] font-normal opacity-70">
          {isPro ? "All features unlocked" : "Some features locked — upgrade prompts active"}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px] gap-1 hover:bg-background/30"
        onClick={exitTestMode}
      >
        <X className="w-3 h-3" />
        Exit Test
      </Button>
    </div>
  );
};

export default TestModeBanner;
