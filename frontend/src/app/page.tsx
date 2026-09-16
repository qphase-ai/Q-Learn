"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const authed = document.cookie.includes("qlearn-auth=1");
    router.replace(authed ? "/dashboard" : "/auth/login");
  }, [router]);

  return null;
}
