import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TIERS, TierKey } from "@/lib/tier-config";
import { Zap, Check, X, Crown, ArrowLeft, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const tierIcons: Record<TierKey, React.ReactNode> = {
  basic: <Zap className="w-5 h-5" />,
  student: <Sparkles className="w-5 h-5" />,
  pro: <Crown className="w-5 h-5" />,
  team: <Users className="w-5 h-5" />,
};

const PricingPage = () => {
  const { user, session, subscription, isTestMode } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);

  const handleCheckout = async (tier: TierKey) => {
    if (!user || !session?.access_token || isTestMode) {
      toast({
        title: "Sign in required",
        description: isTestMode
          ? "Test mode can't start a real checkout. Sign in to subscribe."
          : "Please sign in to start checkout.",
      });
      navigate("/auth");
      return;
    }
    setLoadingTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: TIERS[tier].price_id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    if (!session?.access_token || isTestMode) {
      toast({
        title: "Sign in required",
        description: isTestMode
          ? "Test mode can't open billing management. Sign in to manage a real subscription."
          : "Please sign in to manage your subscription.",
      });
      navigate("/auth");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const currentTier = subscription?.tier;

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center h-16 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </header>

      <div className="container px-4 py-12 max-w-6xl">
        {/* Title */}
        <div className="text-center mb-12 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Choose Your <span className="text-primary">Plan</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Unlock the full power of Circuit Sage. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {(Object.entries(TIERS) as [TierKey, typeof TIERS[TierKey]][]).map(([key, tier]) => {
            const isPopular = "popular" in tier && tier.popular;
            const isCurrent = currentTier === key;

            return (
              <div
                key={key}
                className={`relative rounded-xl border p-6 flex flex-col ${
                  isPopular
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-success text-success-foreground text-[10px] font-bold uppercase tracking-wider">
                    Current Plan
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPopular ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {tierIcons[key]}
                  </div>
                  <h3 className="font-bold text-foreground">{tier.name}</h3>
                </div>

                <div className="mb-1">
                  <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">/{tier.interval}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">{tier.description}</p>

                <div className="flex-1 space-y-2 mb-6">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      <span className="text-foreground">{f}</span>
                    </div>
                  ))}
                  {tier.excluded.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <X className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground/50">{f}</span>
                    </div>
                  ))}
                </div>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" onClick={handleManage}>
                    Manage Subscription
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${isPopular ? "bg-primary hover:bg-primary/90" : ""}`}
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleCheckout(key)}
                    disabled={loadingTier === key}
                  >
                    {loadingTier === key ? "Loading..." : "Get Started"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-foreground text-center mb-6">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-card border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Feature</th>
                  {(Object.keys(TIERS) as TierKey[]).map((key) => (
                    <th key={key} className={`p-3 text-center font-medium ${key === "pro" ? "text-primary" : "text-foreground"}`}>
                      {TIERS[key].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Daily solves", "5/day", "Unlimited", "Unlimited", "Unlimited"],
                  ["Quick Solver", true, true, true, true],
                  ["DC Analysis", false, true, true, true],
                  ["Mesh/Nodal Analysis", false, true, true, true],
                  ["AC Phasor Analysis", false, true, true, true],
                  ["Practice Exams", false, true, true, true],
                  ["Laplace/Fourier", false, false, true, true],
                  ["Bode Plot", false, false, true, true],
                  ["Snap & Solve", false, false, true, true],
                  ["PDF Export", false, false, true, true],
                  ["Check My Homework", false, false, true, true],
                  ["Save Problems", false, true, true, true],
                  ["Team Seats", "1", "1", "1", "10"],
                  ["Priority Support", false, false, false, true],
                ].map(([feature, ...values], i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-card/50">
                    <td className="p-3 text-foreground">{feature}</td>
                    {values.map((val, j) => (
                      <td key={j} className="p-3 text-center">
                        {val === true ? (
                          <Check className="w-4 h-4 text-success mx-auto" />
                        ) : val === false ? (
                          <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        ) : (
                          <span className="text-foreground font-medium">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Guest note */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          Not ready to commit? Try <strong>1 free solve</strong> without signing up.
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
