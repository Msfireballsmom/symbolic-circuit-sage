import PublicPage from '@/components/PublicPage';
import { SITE_NAME, SUPPORT_EMAIL } from '@/lib/site-config';

export default function ContactPage() {
  return (
    <PublicPage title="Contact & Support">
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Report a wrong or withheld answer</h3>
        <p>Include the full problem text, the values and connections you entered or confirmed, and the answer you expected. Include the answer shown or the message explaining why it was withheld, so we can reproduce the problem. Please leave out personal information and private assignment material you are not allowed to share.</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">General questions</h3>
        <p>For questions about {SITE_NAME} or to report a problem, use the support address below when it becomes available.</p>
        {SUPPORT_EMAIL ? (
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Circuit Sage support')}`} className="text-primary hover:underline break-all">{SUPPORT_EMAIL}</a>
        ) : <p className="text-foreground">Support email coming soon.</p>}
      </section>
    </PublicPage>
  );
}