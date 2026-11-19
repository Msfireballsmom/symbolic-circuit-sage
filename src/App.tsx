import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { FreeRunProvider } from "@/hooks/useFreeRun";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import PricingPage from "./pages/PricingPage";
import NotFound from "./pages/NotFound";
import { AUTH_ENABLED } from "@/lib/feature-flags";

const queryClient = new QueryClient();

// Login is intentionally not required yet: the app is fully usable signed-out
// until Stripe billing launches. Re-enable the redirect to /auth at that point.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();
  if (!AUTH_ENABLED) return <>{children}</>;
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary animate-pulse text-sm font-mono">Loading...</div>
    </div>
  );
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    {/* Sign-in page is hidden until Stripe launches: /auth sends visitors straight to the app. */}
    <Route path="/auth" element={<Navigate to="/" replace />} />
    <Route path="/login" element={AUTH_ENABLED ? <AuthRoute><AuthPage /></AuthRoute> : <Navigate to="/" replace />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <FreeRunProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </FreeRunProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
