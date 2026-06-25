"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type BalancePrivacyContextValue = {
  balancesHidden: boolean;
  toggleBalancesHidden: () => void;
  setBalancesHidden: (hidden: boolean) => void;
};

const STORAGE_KEY = "aurexbank:balances-hidden";
const BalancePrivacyContext = createContext<BalancePrivacyContextValue | null>(null);

function readStoredPreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function BalancePrivacyProvider({ children }: { children: React.ReactNode }) {
  const [balancesHidden, setBalancesHiddenState] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBalancesHiddenState(readStoredPreference());
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const setBalancesHidden = useCallback((hidden: boolean) => {
    setBalancesHiddenState(hidden);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(hidden));
    }
  }, []);

  const toggleBalancesHidden = useCallback(() => {
    setBalancesHiddenState((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      balancesHidden,
      setBalancesHidden,
      toggleBalancesHidden,
    }),
    [balancesHidden, setBalancesHidden, toggleBalancesHidden]
  );

  return (
    <BalancePrivacyContext.Provider value={value}>
      {children}
    </BalancePrivacyContext.Provider>
  );
}

export function useBalancePrivacy() {
  const context = useContext(BalancePrivacyContext);

  if (!context) {
    throw new Error("useBalancePrivacy must be used within BalancePrivacyProvider");
  }

  return context;
}
