import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTask, fetchTasksByDate } from "./taskService";
import {
  createHabit,
  fetchHabits,
  toggleLog,
} from "./habitService";

const GUEST_DEMO_SEED_KEY = "GUEST_DEMO_DATA_V1";

function dateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Seed only the first guest session; never overwrite guest-created data. */
export async function seedGuestDemoData(): Promise<void> {
  if ((await AsyncStorage.getItem(GUEST_DEMO_SEED_KEY)) === "1") return;

  const now = new Date();
  const today = dateString(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = dateString(tomorrowDate);

  const tasks = await fetchTasksByDate(today, undefined, true);
  if (tasks.length === 0) {
    await createTask(
      {
        title: "Plan the day",
        description: "Choose one important thing to finish today.",
        date: today,
        time: "",
        priority: "high",
        completed: false,
      },
      undefined,
      true
    );
    await createTask(
      {
        title: "Take a short walk",
        description: "A little movement between tasks.",
        date: today,
        time: "",
        priority: "medium",
        completed: false,
      },
      undefined,
      true
    );
    await createTask(
      {
        title: "Prepare for tomorrow",
        description: "Set up an easier morning.",
        date: tomorrow,
        time: "",
        priority: "low",
        completed: false,
      },
      undefined,
      true
    );
  }

  const habits = await fetchHabits(undefined, true);
  if (habits.length === 0) {
    const reading = await createHabit(
      {
        name: "Read for 15 minutes",
        description: "A small daily pause to learn or unwind.",
        icon: "book-outline",
        color: "#7C3AED",
      },
      undefined,
      true
    );
    const movement = await createHabit(
      {
        name: "Move your body",
        description: "Stretch, walk, or do a short workout.",
        icon: "walk-outline",
        color: "#0EA5E9",
      },
      undefined,
      true
    );
    await toggleLog(reading.id, today, undefined, true);
    await toggleLog(movement.id, tomorrow, undefined, true);
  }

  await AsyncStorage.setItem(GUEST_DEMO_SEED_KEY, "1");
}
