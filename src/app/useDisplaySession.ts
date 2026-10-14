import { useEffect, useState } from "react";
import { DEFAULT_SESSION, displaySession, type DisplaySession } from "../services/session";

export function useDisplaySession(): DisplaySession {
  const [session, setSession] = useState(DEFAULT_SESSION);
  useEffect(() => {
    let live = true;
    void displaySession().then((s) => live && setSession(s));
    return () => {
      live = false;
    };
  }, []);
  return session;
}
