"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import AppIcon from "../ui/AppIcon";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
];

const HIDDEN_ROUTES = [...PUBLIC_ROUTES, "/dashboard"];
const HISTORY_KEY = "aurexbank:navigation-history";
const MAX_HISTORY_ITEMS = 25;
const BACK_EVENT = "aurex:navigate-back";

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isHiddenRoute(pathname: string) {
  return matchesRoute(pathname, HIDDEN_ROUTES);
}

function shouldTrackRoute(pathname: string) {
  return !matchesRoute(pathname, PUBLIC_ROUTES);
}

function readHistory() {
  const stored = window.sessionStorage.getItem(HISTORY_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  window.sessionStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(-MAX_HISTORY_ITEMS))
  );
}

export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!shouldTrackRoute(pathname)) return;

    const history = readHistory();
    const lastPath = history.at(-1);

    if (lastPath !== pathname) {
      writeHistory([...history, pathname]);
    }
  }, [pathname]);

  if (isHiddenRoute(pathname)) return null;

  function goBack() {
    const pageBackEvent = new CustomEvent(BACK_EVENT, { cancelable: true });
    const shouldContinueRouteBack = window.dispatchEvent(pageBackEvent);

    if (!shouldContinueRouteBack) {
      return;
    }

    const history = readHistory();
    const stack = history.at(-1) === pathname ? history.slice(0, -1) : history;
    const previousPath = stack.at(-1) ?? "/dashboard";

    writeHistory(previousPath === "/dashboard" ? ["/dashboard"] : stack);

    if (previousPath === pathname) {
      router.push("/dashboard");
    } else {
      router.push(previousPath);
    }
  }

  return (
    <button
      type="button"
      aria-label="Go back to previous page"
      title="Go back"
      onClick={goBack}
      className="fixed left-2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[45] inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/55 text-zinc-300 backdrop-blur-xl transition-all hover:bg-white/[0.1] hover:text-white active:scale-95 lg:left-[18.45rem] lg:top-2.5"
    >
      <AppIcon name="back" className="h-3 w-3" />
    </button>
  );
}
