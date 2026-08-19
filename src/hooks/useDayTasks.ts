// src/hooks/useDayTasks.ts
import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface DayTask {
  id: string;
  title: string;
  done: boolean;
}

interface StoredTasks {
  date: string;
  tasks: DayTask[];
}

const TASKS_KEY = "@day_tasks";
const today = () => new Date().toISOString().split("T")[0];

function uniqueId(prefix = "task"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractResponseText(root: any): string {
  if (root && typeof root.output_text === "string" && root.output_text.trim()) return root.output_text;
  if (root && Array.isArray(root.output)) {
    const parts: string[] = [];
    for (const msg of root.output) {
      const content = msg?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          const candidates = [
            typeof c?.text === "string" ? c.text : undefined,
            typeof c?.text?.value === "string" ? c.text.value : undefined,
            typeof c?.value === "string" ? c.value : undefined,
            typeof c?.content === "string" ? c.content : undefined,
          ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
          if (candidates.length > 0) parts.push(candidates[0]);
        }
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  if (root && Array.isArray(root.choices) && root.choices.length > 0) {
    const ch = root.choices[0];
    const t = ch?.message?.content ?? ch?.text;
    if (typeof t === "string" && t.trim()) return t;
  }
  return "";
}

export default function useDayTasks() {
  const [tasks, setTasks] = useState<DayTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(TASKS_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredTasks;
          if (parsed.date === today()) {
            setTasks(parsed.tasks || []);
          } else {
            await AsyncStorage.setItem(TASKS_KEY, JSON.stringify({ date: today(), tasks: [] }));
            setTasks([]);
          }
        } catch {
          setTasks([]);
        }
      }
    })();
  }, []);

  const persist = useCallback(async (next: DayTask[]) => {
    setTasks(next);
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify({ date: today(), tasks: next }));
  }, []);

  const toggleTask = useCallback(
    async (id: string) => {
      const next = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      await persist(next);
    },
    [tasks, persist]
  );

  const addFromText = useCallback(
    async (input: string) => {
      if (!input || !input.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const apiKey =
          (process.env as any).EXPO_PUBLIC_OPENAI_API_KEY ||
          (process.env as any).OPENAI_API_KEY ||
          "";
        if (!apiKey) {
          // Fallback: naive split by punctuation/newlines
          const naive = input
            .split(/[\n\.\;\-]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 10)
          .map<DayTask>((t) => ({ id: uniqueId(), title: t, done: false }));
          await persist([...tasks, ...naive]);
          return;
        }
        const prompt = `
Create a concise checklist from the user's plan. Return ONLY JSON:
{
  "tasks": [
    { "id": "<short-id>", "title": "<human task>", "done": false }
  ]
}
User plan:
${input}
`;
        const resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            input: prompt,
            max_output_tokens: 200,
          }),
        });
        const data: any = await resp.json();
        const text = extractResponseText(data)
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        let parsed: { tasks?: Array<{ id?: string; title?: string; done?: boolean }> } = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = {};
        }
        const newTasks: DayTask[] = (parsed.tasks || [])
          .filter((t) => t && typeof t.title === "string" && t.title.trim().length > 0)
          .slice(0, 12)
          .map((t, i) => ({
            // Always generate a local unique id to avoid duplicate key warnings
            id: uniqueId(),
            title: t.title!.trim(),
            done: Boolean(t.done),
          }));
        if (newTasks.length > 0) {
          await persist([...tasks, ...newTasks]);
        }
      } catch (e: any) {
        setError("Failed to analyze tasks.");
      } finally {
        setLoading(false);
      }
    },
    [tasks, persist]
  );

  const clearCompleted = useCallback(async () => {
    const next = tasks.filter((t) => !t.done);
    await persist(next);
  }, [tasks, persist]);

  const clearToday = useCallback(async () => {
    await persist([]);
  }, [persist]);

  return { tasks, loading, error, addFromText, toggleTask, clearCompleted, clearToday };
}


