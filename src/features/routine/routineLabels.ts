import type { RoutineType } from "./types";

export function routineTypeLabel(t: RoutineType): string {
  switch (t) {
    case "morning":
      return "Morning";
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
    case "custom":
      return "Anytime";
  }
}
