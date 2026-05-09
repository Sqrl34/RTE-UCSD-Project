import { analyzeCrewBatch } from "../api/crewTraceApi";

let inflight = null;
let clearTimer = null;

/**
 * Deduplicate analyze-batch while a request is in flight or shortly after it settles.
 * React 18 Strict Mode runs effects twice in dev; sharing one promise avoids duplicate backend work.
 */
export function analyzeCrewBatchDeduped(apiBase, crews) {
  if (inflight) {
    return inflight;
  }

  inflight = analyzeCrewBatch(apiBase, crews).finally(() => {
    if (clearTimer) {
      clearTimeout(clearTimer);
    }
    clearTimer = setTimeout(() => {
      inflight = null;
      clearTimer = null;
    }, 4000);
  });

  return inflight;
}
