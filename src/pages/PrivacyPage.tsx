import { Link } from 'react-router-dom';
import PublicPage from '@/components/PublicPage';

export default function PrivacyPage() {
  return (
    <PublicPage title="Privacy" updated="November 25, 2026">
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Your problems stay in your browser</h3>
        <p>No account or sign-in is needed right now. The solvers run in your browser; the problems you type or load from a text file are not sent to our servers. Photo upload is turned off.</p>
        <p>Saved problems are kept only in this browser’s local storage. You can delete them from the Saved tab or by clearing this site’s data in your browser. They are not synchronized to a server.</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Visits and hosting</h3>
        <p>On the published site, page visits, time on page, page speed, errors, and clicks on buttons and links are recorded for every visitor. Lovable’s visitor analytics uses no cookies, stores nothing on your device, does not keep IP addresses, and does not identify visitors.</p>
        <p>It records the pages visited, where visitors came from, their country, browser, operating system and device type, how long they stay, how fast pages load, errors, and clicks. Detailed data is kept for 90 days and daily summaries for a year. Lovable collects this data for us. <a href="https://lovable.dev/privacy" className="text-primary hover:underline">Lovable’s privacy policy</a> explains how it handles it.</p>
        <p>The hosting provider may separately keep standard server logs, such as IP addresses and request times. Fonts are loaded from Google Fonts; Google receives the font request, including your IP address and browser information.</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">Other information</h3>
        <p>Sign-in controls are disabled. If your browser still holds an earlier sign-in session, Lovable Cloud may refresh that session and read the associated profile, role, solve count and subscription status. Session data may be stored in your browser; this does not send your problem text.</p>
        <p>There are no ads, and we do not sell your data. If you email support once an address is available, your email provider and ours handle the message and the details you choose to include.</p>
        <p>Questions about privacy? Visit <Link to="/contact" className="text-primary hover:underline">Contact & Support</Link>.</p>
      </section>
    </PublicPage>
  );
}