"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { MotionConfig } from "motion/react";
import { auth } from "@/lib/firebase";
import type { Profile } from "@/lib/model";
type Me = { profile: Profile | null; role: string; verified: boolean };
export async function api<T>(
  query: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let token: string | undefined;
  try {
    token = await auth().currentUser?.getIdToken();
  } catch (e) {
    if (auth().currentUser) throw e;
  }
  const r = await fetch(`/api/data${query ? "?" + query : ""}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}
const Context = createContext<{
  user: User | null;
  me: Me | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  toast: (message: string) => void;
}>({
  user: null,
  me: null,
  loading: true,
  error: "",
  refresh: async () => {},
  logout: async () => {},
  toast: () => {},
});
export const useSession = () => useContext(Context);
export function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const toast = useCallback((m: string) => setNotice(m), []);
  const refresh = useCallback(async () => {
    if (!auth().currentUser) {
      setMe(null);
      return;
    }
    const d = await api<Me>("kind=me");
    setMe(d);
    setError("");
  }, []);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth(), async (u) => {
        const current = ++generation;
        setLoading(true);
        setUser(u);
        setMe(null);
        setError("");
        try {
          if (u) {
            const d = await api<Me>("kind=me");
            if (active && current === generation) setMe(d);
          }
        } catch (e) {
          if (active && current === generation) setError((e as Error).message);
        } finally {
          if (active && current === generation) setLoading(false);
        }
      });
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
    return () => {
      active = false;
      generation++;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  return (
    <Context.Provider
      value={{
        user,
        me,
        loading,
        error,
        refresh,
        toast,
        logout: () => signOut(auth()),
      }}
    >
      <MotionConfig reducedMotion="user">
        {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-skillspring" && (
          <div
            role="note"
            style={{
              background: "#245d43",
              color: "white",
              textAlign: "center",
              fontSize: 11,
              padding: "6px 16px",
            }}
          >
            Local demo environment · synthetic people and feedback, not genuine
            community records.
          </div>
        )}
        {children}
        <div
          className={`toast ${notice ? "visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          {notice}
        </div>
      </MotionConfig>
    </Context.Provider>
  );
}
export function useData<T>(query: string | null, poll = 0) {
  const { user } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    setData(null);
    setError("");
  }, [query, user?.uid]);
  useEffect(() => {
    if (query === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let first = true;
    let fetching = false;
    const load = async () => {
      if (fetching || (!first && document.hidden)) return;
      fetching = true;
      try {
        if (first) setLoading(true);
        const d = await api<T>(query, undefined, controller.signal);
        if (!controller.signal.aborted) {
          setData(d);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        first = false;
        fetching = false;
      }
    };
    void load();
    const timer = poll ? setInterval(load, poll) : undefined;
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [query, poll, user?.uid, revision]);
  return { data, error, loading, reload };
}
