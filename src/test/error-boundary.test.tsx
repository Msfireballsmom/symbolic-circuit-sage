// Item 5: a throw inside a panel must render a readable message, not a blank app.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

const Boom = () => {
  throw new Error('chart exploded');
};

describe('ErrorBoundary (item 5)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders a message and a reload action instead of unmounting the app', () => {
    // React also reports the caught error; keep the test output readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary label="DC Nodal"><Boom /></ErrorBoundary>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('DC Nodal stopped responding');
    expect(alert).toHaveTextContent('chart exploded');
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });
});