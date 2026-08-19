/**
 * Streak math + progressive habit-quest helpers.
 *
 * The user opts in per-habit to a streak quest of 21, 60 or 90 days. After
 * a goal is reached the quest auto-promotes to the next tier (21 → 60 → 90),
 * then locks into a "Forever" state.
 *
 * Folklore says it takes ~21 days to build a habit; research (Lally et al.,
 * 2010) puts the median around 66 days. The 21-day starter window plus 60
 * and 90 day promotions roughly bracket that range while giving the user
 * frequent, tangible wins.
 */

export const HABIT_GOAL_TIERS = [21, 60, 90] as const;
export type HabitGoalTier = (typeof HABIT_GOAL_TIERS)[number];

/** Default tier when a user first activates the quest on a habit. */
export const HABIT_DEFAULT_GOAL: HabitGoalTier = 21;

/** No goal = no quest UI; user has not opted in yet. */
export type HabitGoal = HabitGoalTier | null;

export type HabitStageKey =
  | "spark"
  | "build"
  | "lock-in"
  | "forever"
  | "legend"
  | "lifestyle";

export interface HabitStage {
  key: HabitStageKey;
  /** UI title: "Spark", "Build", etc. */
  label: string;
  /** One-line copy describing the phase. */
  motto: string;
  emoji: string;
}

const STAGE_BY_KEY: Record<HabitStageKey, HabitStage> = {
  spark: {
    key: "spark",
    label: "Spark",
    motto: "First fire — show up even on hard days.",
    emoji: "🌱",
  },
  build: {
    key: "build",
    label: "Build",
    motto: "Roots forming. Don’t skip; momentum is fragile.",
    emoji: "🌿",
  },
  "lock-in": {
    key: "lock-in",
    label: "Lock-in",
    motto: "Identity-level. Stay consistent — you’re close.",
    emoji: "🌳",
  },
  forever: {
    key: "forever",
    label: "Forever",
    motto: "Habit anchored. Treat it like brushing your teeth.",
    emoji: "♾️",
  },
  legend: {
    key: "legend",
    label: "Legend",
    motto: "Two months strong — automatic, not effortful.",
    emoji: "👑",
  },
  lifestyle: {
    key: "lifestyle",
    label: "Lifestyle",
    motto: "90 days. This is who you are now.",
    emoji: "🏛️",
  },
};

/**
 * Pick the stage that best describes how far through the *current* goal the
 * user is. The goal is split into thirds — Spark / Build / Lock-in — then a
 * separate banner tier (Forever / Legend / Lifestyle) lights up once the
 * goal is met.
 */
export function getStageForStreak(
  streak: number,
  goal: HabitGoal
): HabitStage {
  if (!goal) {
    if (streak >= 90) return STAGE_BY_KEY.lifestyle;
    if (streak >= 60) return STAGE_BY_KEY.legend;
    if (streak >= 21) return STAGE_BY_KEY.forever;
    if (streak >= 14) return STAGE_BY_KEY["lock-in"];
    if (streak >= 7) return STAGE_BY_KEY.build;
    return STAGE_BY_KEY.spark;
  }
  if (streak >= goal) {
    if (goal >= 90) return STAGE_BY_KEY.lifestyle;
    if (goal >= 60) return STAGE_BY_KEY.legend;
    return STAGE_BY_KEY.forever;
  }
  const third = goal / 3;
  if (streak >= third * 2) return STAGE_BY_KEY["lock-in"];
  if (streak >= third) return STAGE_BY_KEY.build;
  return STAGE_BY_KEY.spark;
}

export interface HabitMilestone {
  /** Streak day at which milestone fires. */
  target: number;
  label: string;
  /** Days remaining until target — 0 if user is *on* that day, else >0. */
  daysAway: number;
}

const MILESTONE_TARGETS: { target: number; label: string }[] = [
  { target: 1, label: "Day 1 — Spark" },
  { target: 3, label: "3-day chain" },
  { target: 7, label: "Week 1 milestone" },
  { target: 14, label: "Week 2 — locking in" },
  { target: 21, label: "21 days — habit anchored" },
  { target: 30, label: "30 days — fully etched" },
  { target: 50, label: "50-day fortress" },
  { target: 60, label: "60 days — automatic" },
  { target: 90, label: "90 days — lifestyle" },
  { target: 200, label: "200-day flame" },
  { target: 365, label: "Full year — once-in-a-lifetime" },
];

/** Next milestone strictly *after* the current streak. */
export function getNextMilestone(streak: number): HabitMilestone {
  const next =
    MILESTONE_TARGETS.find((m) => m.target > streak) ??
    MILESTONE_TARGETS[MILESTONE_TARGETS.length - 1];
  return {
    target: next.target,
    label: next.label,
    daysAway: Math.max(0, next.target - streak),
  };
}

export interface HabitQuestProgress {
  /** Days "filled" toward the current goal — capped at goal. */
  daysInQuest: number;
  /** 0…1 progress toward goal (1 once met). */
  ratio: number;
  /** True once `streak >= goal`. */
  graduated: boolean;
  /** Goal in days (mirrors input). */
  goal: number;
  /** Suggested next tier the user can promote to (after graduating), or null. */
  nextTier: HabitGoalTier | null;
}

/** Goal-aware progress used by the quest strip / progress bar. */
export function getQuestProgress(
  streak: number,
  goal: HabitGoalTier
): HabitQuestProgress {
  const safeStreak = Math.max(0, streak);
  const filled = Math.min(safeStreak, goal);
  return {
    daysInQuest: filled,
    ratio: filled / goal,
    graduated: safeStreak >= goal,
    goal,
    nextTier: getNextGoalTier(goal),
  };
}

/** Get the tier above `current` (21 → 60 → 90 → null when maxed). */
export function getNextGoalTier(current: HabitGoalTier): HabitGoalTier | null {
  const idx = HABIT_GOAL_TIERS.indexOf(current);
  if (idx < 0) return null;
  if (idx >= HABIT_GOAL_TIERS.length - 1) return null;
  return HABIT_GOAL_TIERS[idx + 1];
}

/**
 * Best (longest) historical streak across the entire log set. Independent of
 * `today` — used as a "personal record" the user can chase.
 */
export function getBestStreak(logSet: Set<string>): number {
  if (logSet.size === 0) return 0;
  const sorted = Array.from(logSet).sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    const curr = new Date(`${sorted[i]}T00:00:00`);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diffDays > 1) {
      run = 1;
    }
  }
  return best;
}

/** Whether the user beat their personal best on this very streak. */
export function isAtPersonalBest(current: number, best: number): boolean {
  return current > 0 && current >= best;
}

/**
 * Yesterday-was-completed-but-today-isn't = streak at risk. Encourages a
 * "don't break the chain" nudge on the dashboard tip card.
 */
export function isStreakAtRisk(
  logSet: Set<string>,
  todayStr: string
): boolean {
  if (logSet.has(todayStr)) return false;
  const today = new Date(`${todayStr}T00:00:00`);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");
  return logSet.has(`${y}-${m}-${d}`);
}
