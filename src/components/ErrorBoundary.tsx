import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Where this boundary sits, e.g. "DC Nodal" — named in the message. */
  label: string;
  /** Changing this value clears a caught error (e.g. switching tabs). */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * One throw inside a tab used to unmount the whole SPA to a white page. This
 * renders a readable message and a reload action instead, and logs the error so
 * it stays visible in the console rather than disappearing.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Circuit Sage] ${this.props.label} crashed:`, error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="p-6 rounded-lg bg-card border border-destructive/30 space-y-3">
        <p className="text-sm font-semibold text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {this.props.label} stopped responding
        </p>
        <p className="text-xs text-muted-foreground">
          This panel hit an error, so its results are withheld. Nothing was solved, saved or exported from it.
        </p>
        <p className="text-xs font-mono text-destructive/90 break-words">{error.message}</p>
        <Button size="sm" onClick={() => window.location.reload()} className="gap-1.5 text-xs">
          <RotateCw className="w-3.5 h-3.5" /> Reload
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;