// src/hooks/useQuotes.ts
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Quote { id: string; text: string; author?: string; }

const QUOTES_KEY = "@uniflow_quotes";

export default function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(QUOTES_KEY);
      if (raw) setQuotes(JSON.parse(raw));
    })();
  }, []);

  const save = async (next: Quote[]) => {
    await AsyncStorage.setItem(QUOTES_KEY, JSON.stringify(next));
    setQuotes(next);
  };

  return { quotes, setQuotes: save };
}