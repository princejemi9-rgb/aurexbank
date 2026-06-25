"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";

import {
  clearCachedAdminStatus,
  fetchIsAdmin,
  getCachedAdminStatus,
  type AdminStatus,
} from "../lib/isAdmin";
import { supabase } from "../lib/supabase";

type AdminStatusContextValue = AdminStatus & {
  refreshAdminStatus: () => Promise<boolean>;
};

const AdminStatusContext = createContext<AdminStatusContextValue | null>(null);

function getInitialAdminStatus(): AdminStatus {
  const cachedStatus = getCachedAdminStatus();

  return {
    isAdmin: cachedStatus?.isAdmin === true,
    loading: true,
  };
}

export function AdminStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AdminStatus>(getInitialAdminStatus);
  const activeRequestRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);

  const syncAdminStatus = useCallback(
    async (session: Session | null, force = false) => {
      const requestId = activeRequestRef.current + 1;
      activeRequestRef.current = requestId;

      if (!session?.user?.id) {
        currentUserIdRef.current = null;
        clearCachedAdminStatus();
        setStatus({ isAdmin: false, loading: false });
        return false;
      }

      const userId = session.user.id;
      const isSameUser = currentUserIdRef.current === userId;
      currentUserIdRef.current = userId;
      const cachedStatus = getCachedAdminStatus(userId);

      setStatus((currentStatus) => ({
        isAdmin: cachedStatus?.isAdmin ?? (isSameUser ? currentStatus.isAdmin : false),
        loading: true,
      }));

      const allowed = await fetchIsAdmin({ force, session });

      if (activeRequestRef.current === requestId) {
        setStatus({ isAdmin: allowed, loading: false });
      }

      return allowed;
    },
    []
  );

  const refreshAdminStatus = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return syncAdminStatus(session, true);
  }, [syncAdminStatus]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        await syncAdminStatus(session);
      }
    }

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        syncAdminStatus(session, true);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [syncAdminStatus]);

  const value = useMemo(
    () => ({
      ...status,
      refreshAdminStatus,
    }),
    [refreshAdminStatus, status]
  );

  return (
    <AdminStatusContext.Provider value={value}>
      {children}
    </AdminStatusContext.Provider>
  );
}

export function useAdminStatus() {
  const context = useContext(AdminStatusContext);

  if (!context) {
    throw new Error("useAdminStatus must be used within AdminStatusProvider");
  }

  return context;
}
