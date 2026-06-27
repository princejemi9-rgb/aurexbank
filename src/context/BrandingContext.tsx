"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  BRANDING_CACHE_KEY,
  DEFAULT_BRANDING,
  normalizeBrandingConfig,
  replaceLegacyBrandText,
  type BrandingConfig,
} from "../lib/branding";

type BrandingContextValue = {
  branding: BrandingConfig;
  refreshBranding: () => Promise<void>;
  updateBranding: (branding: BrandingConfig) => void;
};

type TextRecord = {
  output: string;
  source: string;
};

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);
const brandedTextNodes = new WeakMap<Text, TextRecord>();

function applyBrandingStyles(branding: BrandingConfig) {
  const root = document.documentElement;
  const primary = branding.primaryColor;
  const background = branding.backgroundColor;
  const colorVariables: Record<string, string> = {
    "--brand-primary": primary,
    "--brand-background": background,
    "--brand-surface": `color-mix(in srgb, ${background} 92%, ${primary} 8%)`,
    "--brand-surface-strong": `color-mix(in srgb, ${background} 84%, ${primary} 16%)`,
    "--color-green-200": `color-mix(in srgb, ${primary} 45%, white)`,
    "--color-green-300": `color-mix(in srgb, ${primary} 72%, white)`,
    "--color-green-400": primary,
    "--color-green-500": `color-mix(in srgb, ${primary} 82%, black)`,
    "--color-emerald-200": `color-mix(in srgb, ${primary} 45%, white)`,
    "--color-emerald-300": `color-mix(in srgb, ${primary} 72%, white)`,
    "--color-emerald-400": primary,
    "--color-emerald-700": `color-mix(in srgb, ${primary} 58%, black)`,
    "--color-emerald-950": `color-mix(in srgb, ${primary} 18%, ${background})`,
  };

  for (const [name, value] of Object.entries(colorVariables)) {
    root.style.setProperty(name, value);
  }

  document.title = branding.bankName;

  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = background;
}

function processTextNode(node: Text, bankName: string) {
  const current = node.data;
  const previous = brandedTextNodes.get(node);
  const source = previous && current === previous.output ? previous.source : current;
  const output = replaceLegacyBrandText(source, bankName);

  brandedTextNodes.set(node, { source, output });
  if (current !== output) node.data = output;
}

function processBrandText(root: Node, bankName: string) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, bankName);
    return;
  }

  if (!(root instanceof Element)) return;
  if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(root.tagName)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (!parent || !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
      processTextNode(node as Text, bankName);
    }
    node = walker.nextNode();
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const updateBranding = useCallback((nextBranding: BrandingConfig) => {
    const normalized = normalizeBrandingConfig(nextBranding);
    setBranding(normalized);
    try {
      window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(normalized));
    } catch {}
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const response = await fetch("/api/branding", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { branding?: BrandingConfig }
        | null;
      if (response.ok && data?.branding) updateBranding(data.branding);
    } catch {
      // Keep the last known branding when the network is unavailable.
    }
  }, [updateBranding]);

  useEffect(() => {
    let cachedBranding: BrandingConfig | null = null;
    try {
      const cached = window.localStorage.getItem(BRANDING_CACHE_KEY);
      if (cached) cachedBranding = normalizeBrandingConfig(JSON.parse(cached));
    } catch {}

    const cacheTimer = cachedBranding
      ? window.setTimeout(() => updateBranding(cachedBranding), 0)
      : undefined;
    const refreshTimer = window.setTimeout(() => void refreshBranding(), 0);

    return () => {
      if (cacheTimer) window.clearTimeout(cacheTimer);
      window.clearTimeout(refreshTimer);
    };
  }, [refreshBranding, updateBranding]);

  useEffect(() => {
    const interval = window.setInterval(() => void refreshBranding(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshBranding();
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshBranding]);

  useEffect(() => {
    applyBrandingStyles(branding);
    processBrandText(document.body, branding.bankName);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processBrandText(mutation.target, branding.bankName);
          continue;
        }
        mutation.addedNodes.forEach((node) => processBrandText(node, branding.bankName));
      }
    });

    observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding must be used within BrandingProvider");
  }
  return context;
}
