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
  const [securityVerified, setSecurityVerified] = useState<boolean | null>(null);
  const [securityLoading, setSecurityLoading] = useState(true);
  const presenceInFlightRef = useRef(false);
  const securityRequestRef = useRef(0);
  const initialSecurityCheckRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function syncSecurityState(session: Session | null) {
      const requestId = ++securityRequestRef.current;
      const isInitialCheck = initialSecurityCheckRef.current;
      setHasSession(Boolean(session));

      if (!session?.access_token) {
        if (mounted && requestId === securityRequestRef.current) {
          setSecurityVerified(false);
          if (isInitialCheck) {
            initialSecurityCheckRef.current = false;
            setSecurityLoading(false);
            setLoading(false);
          }
        }
        return;
      }

      if (isInitialCheck) setSecurityLoading(true);
      const response = await fetch("/api/auth/security-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "include",
      }).catch(() => null);
      const status = (await response?.json().catch(() => null)) as { verified?: boolean } | null;

      if (mounted && requestId === securityRequestRef.current) {
        setSecurityVerified(status?.verified === true);
        if (isInitialCheck) {
          initialSecurityCheckRef.current = false;
          setSecurityLoading(false);
          setLoading(false);
        }
      }
    }

    void getSessionSafely().then(syncSecurityState);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      void syncSecurityState(session);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading || securityLoading || securityVerified === null) return;

    const isPublic = isPublicRoute(pathname);

    if (!hasSession) {
      if (isPublic) return;
      router.replace("/login");
      return;
    }

    if (pathname === "/security/verify") {
      if (securityVerified) {
        router.replace("/dashboard");
      }
      return;
    }

    if (!securityVerified) {
      router.replace("/security/verify");
      return;
    }

    if (isPublic && pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [hasSession, loading, pathname, router, securityLoading, securityVerified]);

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

  const isPublic = isPublicRoute(pathname);

  if (loading || securityLoading || (hasSession && securityVerified === null)) {
    // show subtle skeleton to avoid flashing protected pages while auth resolves
    return <SkeletonAuth />;
  }

  if (isPublic && !hasSession) {
    return <>{children}</>;
  }

  if (!isPublic && hasSession && securityVerified) {
    return <>{children}</>;
  }

  if (pathname === "/security/verify" && hasSession) return <>{children}</>;

  return null;
}
