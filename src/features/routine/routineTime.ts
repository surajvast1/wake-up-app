import type { Routine } from "./types";

/** Matches dashboard header greeting windows */
export type RoutineSlot = "morning" | "afternoon" | "evening";

export function getCurrentRoutineSlot(d = new Date()): RoutineSlot {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/**
 * Pick which routine the home widget should use.
 * When `stepCounts` is passed, skips empty routines for the current slot so you can
 * leave afternoon/evening unused (no steps) without blocking a routine that has steps.
 */
export function pickRoutineForCurrentSlot(
  routines: Routine[],
  stepCounts?: Record<string, number>
): Routine | null {
  if (routines.length === 0) return null;
  const slot = getCurrentRoutineSlot();

  if (stepCounts) {
    const n = (id: string) => stepCounts[id] ?? 0;
    const hasSteps = (r: Routine) => n(r.id) > 0;

    const slotWith = routines.find(
      (r) => r.routine_type === slot && hasSteps(r)
    );
    if (slotWith) return slotWith;

    const customWith = routines.find(
      (r) => r.routine_type === "custom" && hasSteps(r)
    );
    if (customWith) return customWith;

    const anyWith = routines.find((r) => hasSteps(r));
    if (anyWith) return anyWith;

    return routines.find((r) => r.routine_type === slot) ?? routines[0] ?? null;
  }

  const forSlot = routines.find((r) => r.routine_type === slot);
  if (forSlot) return forSlot;
  const custom = routines.find((r) => r.routine_type === "custom");
  if (custom) return custom;
  return routines[0] ?? null;
}
