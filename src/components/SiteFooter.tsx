import { Link } from 'react-router-dom';
import { SITE_NAME } from '@/lib/site-config';

export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-6 mt-8">
      <div className="container px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>{SITE_NAME} — circuit analysis with explicit verification scope</span>
        <nav aria-label="Site information" className="flex flex-wrap gap-5">
          <Link to="/contact" className="hover:text-primary focus-visible:underline">Contact</Link>
          <Link to="/privacy" className="hover:text-primary focus-visible:underline">Privacy</Link>
          <Link to="/terms" className="hover:text-primary focus-visible:underline">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}