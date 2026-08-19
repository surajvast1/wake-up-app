export type RoutineType = "morning" | "afternoon" | "evening" | "custom";

export interface Routine {
  id: string;
  user_id?: string | null;
  name: string;
  routine_type: RoutineType;
  icon: string;
  color: string;
  created_at: string;
}

export interface RoutineItem {
  id: string;
  routine_id: string;
  title: string;
  description: string;
  order_index: number;
  estimated_time: number;
  is_mandatory: boolean;
}

export interface RoutineLog {
  id: string;
  routine_id: string;
  user_id?: string | null;
  date: string;
  completed: boolean;
  completion_percentage: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface RoutineItemLog {
  id: string;
  routine_log_id: string;
  routine_item_id: string;
  completed: boolean;
  completed_at: string | null;
}

/** Joined view for the active session UI */
export interface RoutineSessionItem extends RoutineItem {
  itemLogId: string;
  done: boolean;
  completedAt: string | null;
}

export interface RoutineSession {
  routine: Routine;
  items: RoutineSessionItem[];
  log: RoutineLog;
  mandatoryTotal: number;
  mandatoryDone: number;
  optionalTotal: number;
  optionalDone: number;
  allTotal: number;
  allDone: number;
  minutesRemaining: number;
  isFullyComplete: boolean;
  /** All mandatory steps done (routine counts as "complete" for streak/widget) */
  mandatoryComplete: boolean;
}

export type RoutineStackParamList = {
  RoutineHub: undefined;
  RoutineToday: { routineId?: string };
  RoutineEditor: { routineId?: string };
};

/** Mon–Sun of current calendar week; from persisted routine_logs */
export interface RoutineWeekDayStat {
  dateStr: string;
  shortLabel: string;
  isToday: boolean;
  /** All mandatory steps done that day */
  completed: boolean;
  /** User opened / started the routine that day */
  started: boolean;
}
