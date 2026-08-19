/**
 * Per-habit "streak quest" goal storage.
 *
 * Stored as a single AsyncStorage map keyed by data-storage scope so guest
 * and supabase users don't bleed into each other. The shape is intentionally
 * decoupled from the `habits` table so we don't need a schema migration to
 * ship the opt-in quest UX. If a habit ID is missing here, the quest is
 * "off" and the UI shows plain streak tracking only.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HABIT_GOAL_TIERS,
  HabitGoal,
  HabitGoalTier,
  getNextGoalTier,
} from "../lib/habitStreak";

const PREFIX = "HABIT_GOALS_V1";

function key(scope: string): string {
  return `${PREFIX}__${scope}`;
}

type GoalMap = Record<string, HabitGoalTier>;

async function readMap(scope: string): Promise<GoalMap> {
  try {
    const raw = await AsyncStorage.getItem(key(scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: GoalMap = {};
    for (const [hid, val] of Object.entries(parsed)) {
      if (
        typeof val === "number" &&
        (HABIT_GOAL_TIERS as readonly number[]).includes(val)
      ) {
        out[hid] = val as HabitGoalTier;
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function writeMap(scope: string, m: GoalMap): Promise<void> {
  try {
    await AsyncStorage.setItem(key(scope), JSON.stringify(m));
  } catch {
    /* swallow — goal is decorative metadata; failing write should not break habit logging */
  }
}

export async function loadHabitGoals(scope: string): Promise<GoalMap> {
  return readMap(scope);
}

export async function getHabitGoal(
  scope: string,
  habitId: string
): Promise<HabitGoal> {
  const m = await readMap(scope);
  return m[habitId] ?? null;
}

export async function setHabitGoal(
  scope: string,
  habitId: string,
  goal: HabitGoal
): Promise<void> {
  const m = await readMap(scope);
  if (goal == null) {
    delete m[habitId];
  } else {
    m[habitId] = goal;
  }
  await writeMap(scope, m);
}

/**
 * Promote a habit's goal to the next tier when its streak passes the
 * current goal (21 → 60 → 90). Returns the new goal (unchanged when
 * already at the top tier or when streak hasn't reached the goal).
 */
export async function maybePromoteHabitGoal(
  scope: string,
  habitId: string,
  streak: number
): Promise<HabitGoalTier | null> {
  const current = (await readMap(scope))[habitId];
  if (!current) return null;
  if (streak < current) return current;
  const next = getNextGoalTier(current);
  if (!next) return current;
  await setHabitGoal(scope, habitId, next);
  return next;
}
