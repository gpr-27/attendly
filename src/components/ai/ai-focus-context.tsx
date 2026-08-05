"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AiFocus } from "@/lib/ai/ai-focus";

export type AiFocusUi = "coach" | "insight";

type RequestFocusOpts = {
  /** Open mobile coach sheet (Today dock / Analytics FAB). Default false for insight. */
  openSheet?: boolean;
  /**
   * coach = full chat panel (Today / Analytics)
   * insight = focused cards modal (Subjects / Timetable / Calendar)
   * Default: insight
   */
  ui?: AiFocusUi;
};

type AiFocusContextValue = {
  focus: AiFocus | null;
  /** Bumps when focus is (re)requested so auto-insight re-fires. */
  focusNonce: number;
  /** Mobile FAB / Today sheet open. */
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  /** Subject/class insight modal (no chat). */
  insightOpen: boolean;
  setInsightOpen: (open: boolean) => void;
  /**
   * Focus on a subject/session.
   * Default opens the insight modal; pass ui:"coach" for full chat.
   */
  requestFocus: (next: AiFocus, opts?: RequestFocusOpts) => void;
  clearFocus: () => void;
};

const AiFocusContext = createContext<AiFocusContextValue | null>(null);

const PANEL_ID = "page-ai-panel";

export function AiFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<AiFocus | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);

  const requestFocus = useCallback(
    (next: AiFocus, opts?: RequestFocusOpts) => {
      const ui = opts?.ui ?? "insight";
      setFocus(next);
      setFocusNonce((n) => n + 1);
      if (ui === "coach") {
        setInsightOpen(false);
        if (opts?.openSheet !== false) {
          setSheetOpen(true);
        }
        requestAnimationFrame(() => {
          document
            .getElementById(PANEL_ID)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } else {
        setSheetOpen(false);
        setInsightOpen(true);
      }
    },
    [],
  );

  const clearFocus = useCallback(() => {
    setFocus(null);
    setInsightOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      focus,
      focusNonce,
      sheetOpen,
      setSheetOpen,
      insightOpen,
      setInsightOpen,
      requestFocus,
      clearFocus,
    }),
    [focus, focusNonce, sheetOpen, insightOpen, requestFocus, clearFocus],
  );

  return (
    <AiFocusContext.Provider value={value}>{children}</AiFocusContext.Provider>
  );
}

export function useAiFocus(): AiFocusContextValue {
  const ctx = useContext(AiFocusContext);
  if (!ctx) {
    throw new Error("useAiFocus must be used within AiFocusProvider");
  }
  return ctx;
}

/** Optional hook — returns null outside provider (safe for isolated stories). */
export function useAiFocusOptional(): AiFocusContextValue | null {
  return useContext(AiFocusContext);
}

export { PANEL_ID as AI_PANEL_DOM_ID };
