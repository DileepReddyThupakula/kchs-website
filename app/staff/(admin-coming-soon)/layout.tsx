import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/staff/auth";

export default async function AdminComingSoonLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
