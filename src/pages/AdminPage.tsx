import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import ET310Coverage from '@/components/ET310Coverage';
import UnavailableWorkflow from '@/components/UnavailableWorkflow';
import { AUTH_ENABLED } from '@/lib/feature-flags';

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <p role="status" className="p-6 text-muted-foreground">Loading…</p>;
  if (!user || !isAdmin) return <main className="container py-12 space-y-4">
    <h1 className="text-xl font-semibold text-foreground">Admin Access Required</h1>
    <p className="text-muted-foreground">A real signed-in administrator account is required. Test personas cannot grant administrator access.</p>
    <UnavailableWorkflow id="generation" />
    <UnavailableWorkflow id="history" />
    <Button variant="outline" onClick={() => navigate(!AUTH_ENABLED || user ? '/' : '/auth')}>{!AUTH_ENABLED || user ? 'Back to App' : 'Sign In'}</Button>
  </main>;
  return <main className="container py-8 space-y-6">
    <Button variant="outline" onClick={() => navigate('/')}>Back to App</Button>
    <ET310Coverage />
    <UnavailableWorkflow id="generation" />
    <UnavailableWorkflow id="history" />
  </main>;
}
