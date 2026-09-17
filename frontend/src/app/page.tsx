"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const devNoAuth =
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_DEV_NO_AUTH === "1";
    const authed = document.cookie.includes("qlearn-auth=1");
    router.replace(authed || devNoAuth ? "/dashboard" : "/auth/login");
  }, [router]);

  return null;
}
