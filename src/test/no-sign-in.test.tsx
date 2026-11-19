// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { AUTH_ENABLED, PAYMENTS_ENABLED } from '@/lib/feature-flags';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFreeRun } from '@/hooks/useFreeRun';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
    },
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

// Testing Library's DOM peer is absent; use the installed React DOM tools
// without changing dependencies or replacing any real tab components.
let root: Root | undefined;
let container: HTMLDivElement | undefined;
const forbidden = /sign ?in|log ?in|sign ?up|create account|upgrade|free run/i;
const normalize = (text: string | null) => text?.replace(/\s+/g, ' ').trim() ?? '';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe() {} } } } as ReturnType<typeof supabase.auth.onAuthStateChange>);
  vi.clearAllMocks();
});

async function renderAt(path: string) {
  window.history.pushState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root?.render(<App />); });
}

function assertNoSignIn() {
  expect(document.body.textContent).not.toMatch(forbidden);
  expect(document.querySelector('input[type="password"]')).toBeNull();
  for (const element of document.querySelectorAll('a, button')) {
    expect(element.getAttribute('href') ?? '').not.toMatch(/^\/(login|auth)(?:[/?#]|$)/);
    expect(element.getAttribute('formaction') ?? '').not.toMatch(/^\/(login|auth)(?:[/?#]|$)/);
  }
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('sign-in disabled for real signed-out testing', () => {
  it('keeps auth and payments disabled', () => {
    expect(AUTH_ENABLED).toBe(false);
    expect(PAYMENTS_ENABLED).toBe(false);
  });

  it('renders the app without account links or upgrade/meter text', async () => {
    await renderAt('/');
    expect(document.body).toHaveTextContent('Circuit calculations within');
    assertNoSignIn();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['DC Nodal', 'Solve Circuit'],
    ['1st-Order Transient', 'First-Order Transient Parameters'],
    ['2nd-Order RLC', 'Second-Order RLC Transient Parameters'],
    ['Snap & Solve', 'Parse Text'],
    ['Saved', 'Saved Problems'],
    ['Reference', 'Quick Reference — Circuit Formulas'],
  ])('opens %s without a gate', async (name, content) => {
    await renderAt('/');
    const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find(element => normalize(element.textContent) === name);
    if (!trigger) throw new Error(`Missing working tab: ${name}`);
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      trigger.click();
    });
    expect(trigger).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[role="tabpanel"][data-state="active"]')).toHaveTextContent(content);
    expect(document.body.textContent).not.toMatch(/\block\b/i);
    assertNoSignIn();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(['/login', '/auth'])('redirects %s to the main app', async path => {
    await renderAt(path);
    expect(window.location.pathname).toBe('/');
    expect(document.body).toHaveTextContent('Circuit calculations within');
    assertNoSignIn();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('disables all four tier buttons without checkout navigation or API calls', async () => {
    await renderAt('/pricing');
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .filter(button => normalize(button.textContent) === 'Not on sale yet');
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      expect(button).toBeDisabled();
      await act(async () => { button.click(); });
      expect(window.location.pathname).toBe('/pricing');
    }
    expect(document.body.textContent).not.toMatch(/get started|manage subscription|sign ?in/i);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('does not record a free run or invoke the daily counter when signed out', async () => {
    function CompletionProbe() {
      const { available, consumed, markSolveCompleted } = useFreeRun();
      const { incrementSolve } = useAuth();
      return <button onClick={() => { markSolveCompleted(); void incrementSolve(); }}>
        {String(available)} / {String(consumed)}
      </button>;
    }
    const { AuthProvider } = await import('@/hooks/useAuth');
    const { FreeRunProvider } = await import('@/hooks/useFreeRun');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    await act(async () => { root?.render(<AuthProvider><FreeRunProvider><CompletionProbe /></FreeRunProvider></AuthProvider>); });
    const button = container.querySelector('button');
    if (!button) throw new Error('Missing completion probe');
    await act(async () => { button.click(); });
    expect(button).toHaveTextContent('true / false');
    expect(storageWrite).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});