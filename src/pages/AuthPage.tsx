import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, FlaskConical, Crown, User, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

const AuthPage = () => {
  const { signIn, signUp, enterTestMode } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const result = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password);
    
    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary mx-auto">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Circuit <span className="text-primary glow-text">Sage</span>
          </h1>
          <p className="text-sm text-muted-foreground">Reads your assignment. Shows every step.</p>
        </div>

        {/* Auth Form */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          <h2 className="text-lg font-semibold text-foreground text-center">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="pl-10 h-11 bg-background"
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10 h-11 bg-background"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10 pr-10 h-11 bg-background"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Test Mode Section */}
        <div className="p-4 rounded-xl bg-card/50 border border-dashed border-border space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider">Test Mode — No Account Needed</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12 gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 text-primary"
              onClick={() => enterTestMode("pro")}
            >
              <Crown className="w-4 h-4" />
              <div className="text-left">
                <div className="text-xs font-semibold">Test Pro</div>
                <div className="text-[10px] text-muted-foreground">All features</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-12 gap-2 border-border hover:bg-muted"
              onClick={() => enterTestMode("free")}
            >
              <User className="w-4 h-4" />
              <div className="text-left">
                <div className="text-xs font-semibold">Test Free</div>
                <div className="text-[10px] text-muted-foreground">Gated view</div>
              </div>
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          By signing up you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
