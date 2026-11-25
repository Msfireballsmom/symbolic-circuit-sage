// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import App from '@/App';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  },
  from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() },
} }));

describe('Public launch pages', () => {
  it.each([
    ['/contact', 'Contact & Support'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms of Use'],
    ['/missing-page', 'Page not found'],
  ])('renders %s with shared navigation', async (path, title) => {
    window.history.pushState({}, '', path);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => { root.render(<App />); });
      expect(container.querySelector('main h2')).toHaveTextContent(title);
      expect(container.querySelector('main a[href="/"]')).toHaveTextContent('Back to Circuit Sage');
      expect(container.querySelectorAll('footer a')).toHaveLength(3);
      if (path === '/contact') {
        expect(container.textContent).toContain('Support email coming soon.');
        expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
      }
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  it('links the main app footer to Contact, Privacy and Terms', async () => {
    window.history.pushState({}, '', '/');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => { root.render(<App />); });
      expect(Array.from(container.querySelectorAll('footer a')).map(a => [a.textContent, a.getAttribute('href')])).toEqual([
        ['Contact', '/contact'], ['Privacy', '/privacy'], ['Terms', '/terms'],
      ]);
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});