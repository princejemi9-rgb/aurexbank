"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import SkeletonAuth from "./SkeletonAuth";
import { useAdminStatus } from "../../context/AdminStatusContext";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, loading, router]);

  if (loading) return <SkeletonAuth />;
  if (!isAdmin) return null;

  return <>{children}</>;
}

