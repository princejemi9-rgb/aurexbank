"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import SkeletonAuth from "./SkeletonAuth";

const SESSION_TIMEOUT_MS = 8000;
const PRESENCE_TIMEOUT_MS = 8000;
const ROLE_LOOKUP_TIMEOUT_MS = 8000;

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/change-initial-password",
  "/security/verify",
  "/personal-admin",
  "/personal-admin/register",
  "/personal-admin/login",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.includes(pathname);
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

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ROLE_LOOKUP_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [securityVerified, setSecurityVerified] = useState<boolean | null>(null);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [initialPasswordRequired, setInitialPasswordRequired] = useState<boolean | null>(null);
  const [personalAdmin, setPersonalAdmin] = useState<{ status?: string } | null>(null);
  const presenceInFlightRef = useRef(false);
  const securityRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function syncSecurityState(session: Session | null) {
      const requestId = ++securityRequestRef.current;
      setHasSession(Boolean(session));

      if (!session?.access_token) {
        if (mounted && requestId === securityRequestRef.current) {
          setPersonalAdmin(null);
          setSecurityVerified(false);
          setInitialPasswordRequired(false);
          setSecurityLoading(false);
          setLoading(false);
        }
        return;
      }

      // Do not apply customer-passcode routing while the authenticated role is
      // still unknown. A Personal Admin login and its role lookup complete in
      // separate asynchronous steps.
      if (mounted && requestId === securityRequestRef.current) {
        setPersonalAdmin(null);
        setSecurityVerified(null);
        setInitialPasswordRequired(null);
        setSecurityLoading(true);
        setLoading(true);
      }

      // Personal Admins are a separate, approved operational role. They do not
      // use a customer-issued security passcode, and never enter customer UI.
      const personalResponse = await fetchWithTimeout("/api/personal-admin", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const personalData = await personalResponse?.json().catch(() => null) as { personalAdmin?: { status?: string } | null } | null;
      if (personalData?.personalAdmin) {
        if (mounted && requestId === securityRequestRef.current) {
          setPersonalAdmin(personalData.personalAdmin);
          setSecurityVerified(true);
          setInitialPasswordRequired(false);
          setSecurityLoading(false);
          setLoading(false);
        }
        return;
      }
      if (!mounted || requestId !== securityRequestRef.current) return;

      // A role request that cannot complete must never hold the application on
      // its loading shell. Leave the dedicated Personal Admin entry route
      // visible so the user can retry, rather than guessing a customer role.
      if (!personalResponse?.ok) {
        setPersonalAdmin(null);
        setSecurityVerified(false);
        setInitialPasswordRequired(false);
        setSecurityLoading(false);
        setLoading(false);
        return;
      }
      setPersonalAdmin(null);

      const initialPasswordResponse = await fetchWithTimeout("/api/auth/initial-password-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const initialPasswordData = (await initialPasswordResponse?.json().catch(() => null)) as { required?: boolean } | null;
      if (!mounted || requestId !== securityRequestRef.current) return;
      setInitialPasswordRequired(initialPasswordData?.required === true);

      // Retry first-time profile setup after email confirmation or a previous network failure.
      if (!session.user.user_metadata?.onboarded_at) {
        void fetch("/api/auth/onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
        }).catch(() => null);
      }
      const response = await fetchWithTimeout("/api/auth/security-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "include",
      });
      const status = (await response?.json().catch(() => null)) as { verified?: boolean } | null;

      if (mounted && requestId === securityRequestRef.current) {
        setSecurityVerified(status?.verified === true);
        setSecurityLoading(false);
        setLoading(false);
      }
    }

    void getSessionSafely().then(syncSecurityState);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // A refresh only replaces the provider access token. The independent,
      // signed Aurex security session remains valid, so rechecking here can
      // temporarily unmount the passcode form without changing authorization.
      if (event === "TOKEN_REFRESHED") return;

      void syncSecurityState(session);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading || securityLoading || securityVerified === null || initialPasswordRequired === null) return;

    const isPublic = isPublicRoute(pathname);

    if (!hasSession) {
      if (isPublic) return;
      router.replace("/login");
      return;
    }

    // The public homepage remains available to every visitor, including an
    // authenticated Personal Admin. Other customer-only routes stay protected.
    if (pathname === "/") return;

    // Customer sign-in is an explicit account-switch route. Keep it available
    // even when this browser still has a Personal Admin (or another customer)
    // session, so the submitted credentials—not stale local storage—choose
    // the next account.
    if (pathname === "/auth/signin" || pathname === "/login") return;

    if (personalAdmin) {
      if (pathname === "/personal-admin/register" || pathname === "/personal-admin/login") { router.replace("/personal-admin/dashboard"); return; }
      if (!pathname.startsWith("/personal-admin")) { router.replace("/personal-admin/dashboard"); }
      return;
    }

    // The dedicated Personal Admin form verifies this role before it chooses a
    // destination. Do not briefly send an unrecognised session to the customer
    // dashboard while that form is reporting a failed role lookup.
    if (pathname === "/personal-admin/login" || pathname === "/personal-admin/register") return;

    if (initialPasswordRequired) {
      if (pathname !== "/auth/change-initial-password") router.replace("/auth/change-initial-password");
      return;
    }
    if (pathname === "/auth/change-initial-password") { router.replace("/dashboard"); return; }

    // A security passcode is a step-up check for sending money, not a
    // requirement for reading the normal dashboard. The transfer endpoint
    // repeats this check server-side before it can debit an account.
    if (pathname === "/send" && !securityVerified) {
      router.replace("/security/verify?next=%2Fsend");
      return;
    }

    if (isPublic && pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [hasSession, initialPasswordRequired, loading, pathname, personalAdmin, router, securityLoading, securityVerified]);

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

  // Public entry pages must never depend on browser storage, Supabase, or a
  // role lookup before they can render. A stalled client-side auth request
  // previously left first-time visitors on the black loading shell forever.
  // The routing effect above still redirects authenticated users where that
  // is appropriate once the background check has completed.
  if (isPublic) return <>{children}</>;

  // This is an intentional public transition route. Keeping it mounted while
  // session status resolves prevents a background auth event from clearing an
  // in-progress passcode entry.
  if (pathname === "/security/verify") return <>{children}</>;

  // The Personal Admin form performs its own role lookup after authentication.
  // Do not unmount it for the global auth refresh: doing so loses the form's
  // successful sign-in result and makes the page appear to ignore Submit.
  if (pathname === "/personal-admin/login" || pathname === "/personal-admin/register") {
    return <>{children}</>;
  }

  if (loading || securityLoading || (hasSession && (securityVerified === null || initialPasswordRequired === null))) {
    // show subtle skeleton to avoid flashing protected pages while auth resolves
    return <SkeletonAuth />;
  }

  // An authenticated account may need to complete its Personal Admin
  // application here. Keep this public entry form rendered while its role is
  // unresolved instead of returning an empty page.
  if (isPublic && !hasSession) {
    return <>{children}</>;
  }

  if (!isPublic && hasSession) {
    return <>{children}</>;
  }

  return null;
}
