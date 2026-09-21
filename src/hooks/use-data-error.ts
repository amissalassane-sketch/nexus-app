"use client";

// ============================================================
// NEXUS — useDataError
// One error slot for a product manager (projects, tasks, goals): the
// friendly sentence the human reads, plus — when the failure came from
// the database — the bounded diagnostic triple (code / message / hint)
// rendered in small text under it and written to the browser console.
//
// Why a hook and not a second useState in each manager: the managers
// clear and set their error from a dozen places (validation, plan gate,
// workspace bootstrap, every mutation). Keeping the sentence and the
// diagnostic in ONE state value guarantees they can never drift apart —
// a plain `setError("Please provide a name.")` drops any stale
// diagnostic, and a `reportDataError(...)` always pairs the two.
// ============================================================

import { useCallback, useState } from "react";
import {
  humanizeDataError,
  logDataError,
  type DataErrorDetail,
  type DataErrorLike,
} from "@/lib/data-errors";

type DataErrorState = { message: string; detail: DataErrorDetail | null };

const NO_ERROR: DataErrorState = { message: "", detail: null };

export function useDataError() {
  const [state, setState] = useState<DataErrorState>(NO_ERROR);

  /** Plain product copy (validation, workspace not connected, plan gate…).
   *  Carries no diagnostic; an empty string clears the slot. */
  const setError = useCallback((message: string) => {
    setState(message ? { message, detail: null } : NO_ERROR);
  }, []);

  /**
   * A failed Supabase read/write. `context` names the operation
   * ("projects.create", "tasks.load"…) and is the only thing that differs
   * between the console line and the on-screen diagnostic. The friendly
   * sentence is unchanged from before (humanizeDataError); the code is
   * what is new.
   */
  const reportDataError = useCallback(
    (context: string, cause: DataErrorLike, fallback?: string) => {
      const detail = logDataError(context, cause);
      setState({ message: humanizeDataError(cause, fallback), detail });
    },
    []
  );

  return {
    error: state.message,
    errorDetail: state.detail,
    setError,
    reportDataError,
  };
}
