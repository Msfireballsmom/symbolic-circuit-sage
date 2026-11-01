// Item 5: a throw inside a panel must render a readable message, not a blank app.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ErrorBoundary from '@/components/ErrorBoundary';

const Boom = () => {
  throw new Error('chart exploded');
};

describe('ErrorBoundary (item 5)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders a message and a reload action instead of unmounting the app', () => {
    // React also reports the caught error; keep the test output readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<ErrorBoundary label="DC Nodal"><Boom /></ErrorBoundary>));
      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveTextContent('DC Nodal stopped responding');
      expect(alert).toHaveTextContent('chart exploded');
      const reload = container.querySelector('button');
      expect(reload).toBeInTheDocument();
      expect(reload).toHaveTextContent(/reload/i);
      expect(spy).toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});