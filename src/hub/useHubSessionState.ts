import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readHubSession, writeHubSession } from "../core/hubSession";

/** Memorizes transient UI state while switching tabs. Not disk-persistent. */
export function useHubSessionState<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readHubSession(key, fallback));
  useEffect(() => { writeHubSession(key, state); }, [key, state]);
  return [state, setState];
}
