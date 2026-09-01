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
  const [isAdmin, setIsAdmin] = useState(false);
  const [securityVerified, setSecurityVerified] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(true);
  const presenceInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function initializeSession() {
      const session = await getSessionSafely();
      if (!mounted) return;

      setHasSession(!!session);
      if (session?.access_token) {
        const [securityResponse, adminResponse] = await Promise.all([
          fetch("/api/auth/security-status", { headers: { Authorization: `Bearer ${session.access_token}` }, credentials: "include" }).catch(() => null),
          fetch("/api/admin/status", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null),
        ]);
        const status = await securityResponse?.json().catch(() => null) as { verified?: boolean } | null;
        const adminData = await adminResponse?.json().catch(() => null) as { isAdmin?: boolean } | null;
        const admin = adminData?.isAdmin === true;
        if (mounted) {
          setIsAdmin(admin);
          setSecurityVerified(status?.verified === true || admin);
        }
      } else {
        if (mounted) {
          setIsAdmin(false);
          setSecurityVerified(false);
        }
      }
      if (mounted) setSecurityLoading(false);
      setLoading(false);
    }

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
      setIsAdmin(false);
      setSecurityVerified(false);
      setSecurityLoading(!session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading || securityLoading) return;

    const isPublic = isPublicRoute(pathname);

    if (!isPublic && !hasSession) {
      router.replace("/login");
      return;
    }

    if (hasSession && isAdmin) {
      if (pathname === "/security/verify") {
        router.replace("/dashboard");
      }
      if (isPublic && pathname !== "/dashboard") {
        router.replace("/dashboard");
      }
      return;
    }

    if (hasSession && pathname === "/security/verify" && securityVerified) {
      router.replace("/dashboard");
      return;
    }
    if (hasSession && !securityVerified && pathname !== "/security/verify") {
      router.replace("/security/verify");
      return;
    }
    if (isPublic && hasSession && securityVerified && pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [hasSession, isAdmin, loading, pathname, router, securityLoading, securityVerified]);

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

  if (loading || (hasSession && securityLoading)) {
    // show subtle skeleton to avoid flashing auth pages
    return <SkeletonAuth />;
  }

  const isPublic = isPublicRoute(pathname);

  if (isPublic && !hasSession) {
    return <>{children}</>;
  }

  if (!isPublic && hasSession && securityVerified) {
    return <>{children}</>;
  }

  if (pathname === "/security/verify" && hasSession) return <>{children}</>;

  return null;
}
