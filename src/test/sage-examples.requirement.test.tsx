// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import CircuitSagePanel from '@/components/CircuitSagePanel';
import { runSage } from './real-problems/pipeline';

vi.mock('@/hooks/useFreeRun', () => ({ useFreeRun: () => ({ markSolveCompleted: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

describe('Every Snap & Solve example shows a verified answer after confirmation', () => {
  it('A student can parse and confirm every listed example and see its verified answer', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => { root.render(<CircuitSagePanel />); });
      const examples = Array.from(container.querySelectorAll<HTMLButtonElement>('button[title]'));
      expect(examples.length).toBeGreaterThan(0);
      for (const example of examples) {
        const text = example.title;
        expect(runSage(text).shown, text).toBe(true);
        await act(async () => { example.click(); });
        const parse = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Parse Text'));
        if (!parse) throw new Error('Parse control missing');
        await act(async () => { parse.click(); });
        const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Confirm netlist'));
        if (!confirm) throw new Error(`Confirmation missing for ${text}`);
        await act(async () => { confirm.click(); });
        expect(container.textContent, text).toContain('Verified solution — independent equations and power checks passed');
        expect(container.textContent, text).not.toContain('Answer withheld');
      }
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});