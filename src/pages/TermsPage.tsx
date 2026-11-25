import PublicPage from '@/components/PublicPage';
import { SITE_NAME } from '@/lib/site-config';

export default function TermsPage() {
  return (
    <PublicPage title="Terms of Use" updated="November 25, 2026">
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">A study aid, not a substitute for your work</h3>
        <p>{SITE_NAME} is a study aid. Check results against your own work and follow your school’s academic-integrity rules.</p>
        <p>Certified answers are shown only inside the tested scope and are withheld otherwise. Tested scope is not full course coverage, and no tool is error-free.</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Use at your own risk</h3>
        <p>The service is provided as-is, without warranty. Do not rely on it for safety-critical decisions or professional circuit design.</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Responsible use and changes</h3>
        <p>Do not misuse the service, including scraping it, attacking it, or attempting to disrupt it or access information without permission.</p>
        <p>These terms may change. The last-updated date above indicates the current version.</p>
      </section>
    </PublicPage>
  );
}