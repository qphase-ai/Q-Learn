"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuroraBackground } from "@/components/backgrounds";

export default function RootPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const devNoAuth =
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_DEV_NO_AUTH === "1";
    const authed = document.cookie.includes("qlearn-auth=1");
    if (authed || devNoAuth) {
      router.replace("/dashboard");
    } else {
      setShow(true);
    }
  }, [router]);

  if (!show) return null;

  return (
    <>
      <AuroraBackground />
      <main className="relative min-h-screen">
        {/* sections assembled in Task 7 */}
      </main>
    </>
  );
}
