import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { PRICE_TO_TIER, PRODUCT_TO_TIER, TierKey } from "@/lib/tier-config";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_tier: "free" | "pro";
  stripe_customer_id: string | null;
}

interface Subscription {
  subscribed: boolean;
  tier: TierKey | null;
  subscriptionEnd: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  dailySolves: number;
  isPro: boolean;
  isAdmin: boolean;
  loading: boolean;
  isTestMode: boolean;
  testTier: "free" | "pro" | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  incrementSolve: () => Promise<boolean>;
  enterTestMode: (tier: "free" | "pro") => void;
  exitTestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TEST_PRO_PROFILE: Profile = {
  id: "test-pro-user",
  email: "pro@circuitsage.test",
  full_name: "Alex Engineer (Pro)",
  subscription_tier: "pro",
  stripe_customer_id: "cus_test_pro",
};

const TEST_FREE_PROFILE: Profile = {
  id: "test-free-user",
  email: "student@circuitsage.test",
  full_name: "Jordan Student (Free)",
  subscription_tier: "free",
  stripe_customer_id: null,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [dailySolves, setDailySolves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testTier, setTestTier] = useState<"free" | "pro" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data as Profile);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleData);
  };

  const refreshSubscription = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      if (data) {
        let tier: TierKey | null = null;
        if (data.price_id && PRICE_TO_TIER[data.price_id]) {
          tier = PRICE_TO_TIER[data.price_id];
        } else if (data.product_id && PRODUCT_TO_TIER[data.product_id]) {
          tier = PRODUCT_TO_TIER[data.product_id];
        }
        setSubscription({
          subscribed: data.subscribed,
          tier,
          subscriptionEnd: data.subscription_end,
        });
      }
    } catch (err) {
      console.error("Failed to check subscription:", err);
    }
  }, [session?.access_token]);

  const fetchDailySolves = useCallback(async (userId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("daily_solves")
      .select("solve_count")
      .eq("user_id", userId)
      .eq("solve_date", today)
      .maybeSingle();
    setDailySolves(data?.solve_count ?? 0);
  }, []);

  const incrementSolve = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc('increment_daily_solve');
    if (error) return false;
    if (typeof data === 'number') setDailySolves(data);
    return true;
  }, [user]);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (isTestMode) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
          setTimeout(() => fetchDailySolves(session.user.id), 0);
        } else {
          setProfile(null);
          setSubscription(null);
          setDailySolves(0);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isTestMode) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchDailySolves(session.user.id);
      }
      setLoading(false);
    });

    return () => authSub.unsubscribe();
  }, [isTestMode, fetchDailySolves]);

  // Check subscription on login and every 60s
  useEffect(() => {
    if (!session?.access_token || isTestMode) return;
    refreshSubscription();
    const interval = setInterval(refreshSubscription, 60000);
    return () => clearInterval(interval);
  }, [session?.access_token, isTestMode, refreshSubscription]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (isTestMode) {
      exitTestMode();
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
    setSubscription(null);
    setDailySolves(0);
  };

  const enterTestMode = (tier: "free" | "pro") => {
    setIsTestMode(true);
    setTestTier(tier);
    setProfile(tier === "pro" ? TEST_PRO_PROFILE : TEST_FREE_PROFILE);
    setUser({ id: tier === "pro" ? "test-pro-user" : "test-free-user" } as User);
    setSubscription(tier === "pro" ? { subscribed: true, tier: "pro", subscriptionEnd: null } : null);
    setLoading(false);
  };

  const exitTestMode = () => {
    setIsTestMode(false);
    setTestTier(null);
    setProfile(null);
    setUser(null);
    setSession(null);
    setSubscription(null);
    setDailySolves(0);
  };

  const isPro = isTestMode
    ? testTier === "pro"
    : (subscription?.tier === "pro" || subscription?.tier === "team");

  return (
    <AuthContext.Provider value={{
      user, session, profile, subscription, dailySolves,
      isPro, isAdmin, loading, isTestMode, testTier,
      signUp, signIn, signOut, refreshProfile, refreshSubscription, incrementSolve,
      enterTestMode, exitTestMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
