import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Free monthly full run.
 *
 * Every student — signed in, no subscription — gets one complete end-to-end run
 * per calendar month: snap & solve, parsed component review, the full solution,
 * drawings, homework check, save and export. The meter is only charged once the
 * solve actually completes, never on opening a tab.
 */

interface FreeRunState {
  /** The run has not been used yet this month. */
  available: boolean;
  /** The run was already completed this month. */
  consumed: boolean;
  /** Calendar month the entitlement belongs to, e.g. "2026-08". */
  period: string;
  /** Charge the meter. Call this only after a solve produced a real result. */
  markSolveCompleted: () => void;
}

const FreeRunContext = createContext<FreeRunState | undefined>(undefined);

function currentPeriod(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function storageKey(userId: string, period: string) {
  return `circuit-sage:free-run:${userId}:${period}`;
}

export const FreeRunProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const period = currentPeriod();
  const userId = user?.id ?? "anonymous";
  const [consumed, setConsumed] = useState(false);

  useEffect(() => {
    try {
      setConsumed(localStorage.getItem(storageKey(userId, period)) === "used");
    } catch {
      setConsumed(false);
    }
  }, [userId, period]);

  const markSolveCompleted = useCallback(() => {
    if (consumed) return;
    try {
      localStorage.setItem(storageKey(userId, period), "used");
    } catch {
      /* storage unavailable — the run still counts for this session */
    }
    setConsumed(true);
  }, [consumed, userId, period]);

  const value = useMemo<FreeRunState>(
    () => ({ available: !consumed, consumed, period, markSolveCompleted }),
    [consumed, period, markSolveCompleted],
  );

  return <FreeRunContext.Provider value={value}>{children}</FreeRunContext.Provider>;
};

export const useFreeRun = (): FreeRunState => {
  const ctx = useContext(FreeRunContext);
  if (!ctx) throw new Error("useFreeRun must be used within FreeRunProvider");
  return ctx;
};
