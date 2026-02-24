"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useAuth } from "@/context/AuthContext";

export default function PublicRoute({ children }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      // User is authenticated, redirect based on role
      if (user.userRole === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
      return;
    }

    // User is not authenticated, allow access to public route
    setIsPublic(true);
  }, [user, isLoading, router]);

  if (isLoading) return <LoadingSkeleton />;

  return isPublic ? children : null;
}
