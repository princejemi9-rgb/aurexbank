"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import SkeletonAuth from "./SkeletonAuth";

const SESSION_TIMEOUT_MS = 8000;
const PRESENCE_TIMEOUT_MS = 8000;

const PUBLIC_ROUTES = [
  "/login",
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/security/verify",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

async function getSessionSafely(): Promise<Session | null> {
  let timeoutId: number | undefined;

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(null), SESSION_TIMEOUT_MS);
      }),
    ]);

    return result?.data.session ?? null;
  } catch {
    return null;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const presenceInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function initializeSession() {
      const session = await getSessionSafely();
      if (!mounted) return;

      setHasSession(!!session);
      setLoading(false);
    }

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const isPublic = isPublicRoute(pathname);
    const isAuthPage = pathname === "/login" || pathname.startsWith("/auth/");

    if (!hasSession) {
      if (isPublic) return;
      router.replace("/login");
      return;
    }

    if (isAuthPage) {
      router.replace("/dashboard");
      return;
    }

    if (pathname === "/security/verify") {
      router.replace("/dashboard");
    }
  }, [hasSession, loading, pathname, router]);

  useEffect(() => {
    if (loading || !hasSession) return;

    let active = true;

    async function updatePresence() {
      if (presenceInFlightRef.current) return;

      presenceInFlightRef.current = true;
      const session = await getSessionSafely();
      const token = session?.access_token;

      if (!active || !token) {
        presenceInFlightRef.current = false;
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        PRESENCE_TIMEOUT_MS
      );

      try {
        await fetch("/api/auth/presence", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
      } catch {
        // Presence is best-effort; auth state should not block on this ping.
      } finally {
        window.clearTimeout(timeoutId);
        presenceInFlightRef.current = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        updatePresence();
      }
    }

    updatePresence();
    const interval = window.setInterval(updatePresence, 60 * 1000);

    window.addEventListener("focus", updatePresence);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", updatePresence);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasSession, loading]);

  if (loading) {
    // show subtle skeleton to avoid flashing auth pages
    return <SkeletonAuth />;
  }

  const isPublic = isPublicRoute(pathname);

  if (isPublic && !hasSession) {
    return <>{children}</>;
  }

  if (!isPublic && hasSession) {
    return <>{children}</>;
  }

  if (pathname === "/security/verify" && hasSession) return <>{children}</>;

  return null;
}
