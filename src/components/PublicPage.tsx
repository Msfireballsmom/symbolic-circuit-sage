import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SolverHeader from '@/components/SolverHeader';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME } from '@/lib/site-config';

export default function PublicPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      <SolverHeader />
      <main className="container px-4 py-10 sm:py-14 flex-1">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to {SITE_NAME}
          </Link>
          <h2 className="text-3xl font-bold text-foreground mb-3">{title}</h2>
          {updated && <p className="text-xs font-mono text-muted-foreground mb-8">Last updated: {updated}</p>}
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}