import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_tier: "free" | "pro";
  stripe_customer_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isPro: boolean;
  isAdmin: boolean;
  loading: boolean;
  isTestMode: boolean;
  testTier: "free" | "pro" | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  enterTestMode: (tier: "free" | "pro") => void;
  exitTestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TEST_PRO_PROFILE: Profile = {
  id: "test-pro-user",
  email: "pro@circuitsolverpro.test",
  full_name: "Alex Engineer (Pro)",
  subscription_tier: "pro",
  stripe_customer_id: "cus_test_pro",
};

const TEST_FREE_PROFILE: Profile = {
  id: "test-free-user",
  email: "student@circuitsolverpro.test",
  full_name: "Jordan Student (Free)",
  subscription_tier: "free",
  stripe_customer_id: null,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleData);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (isTestMode) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isTestMode) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isTestMode]);

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
  };

  const enterTestMode = (tier: "free" | "pro") => {
    setIsTestMode(true);
    setTestTier(tier);
    setProfile(tier === "pro" ? TEST_PRO_PROFILE : TEST_FREE_PROFILE);
    setUser({ id: tier === "pro" ? "test-pro-user" : "test-free-user" } as User);
    setLoading(false);
  };

  const exitTestMode = () => {
    setIsTestMode(false);
    setTestTier(null);
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      isPro: isTestMode ? testTier === "pro" : profile?.subscription_tier === "pro",
      loading, isTestMode, testTier,
      signUp, signIn, signOut, refreshProfile,
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
