import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

/**
 * Lightweight offline detector without adding @react-native-community/netinfo.
 *
 * Strategy: ping a tiny 204 endpoint every `intervalMs` (and whenever the app
 * returns to the foreground). This is cheap (~<200 bytes round-trip) and fast
 * enough that users see the offline screen within a few seconds of losing
 * connectivity. When NetInfo is eventually added, this hook can be swapped
 * out without callers changing.
 */
const PING_URL = "https://www.gstatic.com/generate_204";
const DEFAULT_INTERVAL_MS = 15_000;
const TIMEOUT_MS = 6_000;

async function checkReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(PING_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(to);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

const useIsOffline = (intervalMs = DEFAULT_INTERVAL_MS): boolean => {
  const [offline, setOffline] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      const ok = await checkReachable();
      if (mountedRef.current) setOffline(!ok);
    };

    void run();
    timer = setInterval(run, intervalMs);

    const sub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next === "active") void run();
      }
    );

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs]);

  return offline;
};

export default useIsOffline;
