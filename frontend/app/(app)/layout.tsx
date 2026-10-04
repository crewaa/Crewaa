"use client";

import { motion } from "framer-motion";

import DashboardNavbar from "@/components/dashboard/navbar";
import { SessionProvider, useSession } from "@/lib/session";
import { AppShellSkeleton } from "@/components/dashboard/app-shell-skeleton";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();

  // Previously this returned `null` until the user resolved, so every
  // navigation flashed a blank white screen before content appeared.
  if (loading || !user) return <AppShellSkeleton />;

  return (
    // The app surface is dark at the shell level. Individual pages used to set
    // their own `bg-[#06070C]` inside a padded, light-background layout, which
    // produced a white header and a white gutter framing a black panel.
    <div className="min-h-screen bg-[#06070C] text-white">
      <DashboardNavbar user={user} />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="min-h-[calc(100vh-4rem)]"
      >
        {children}
      </motion.main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  );
}
