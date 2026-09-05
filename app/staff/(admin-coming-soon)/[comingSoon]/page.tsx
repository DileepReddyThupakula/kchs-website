import { notFound } from "next/navigation";

import { StaffComingSoon } from "@/components/staff-coming-soon";
import { comingSoonModules, isComingSoonSlug } from "@/lib/staff-navigation";

export default async function ComingSoonPage({ params }: { params: Promise<{ comingSoon: string }> }) {
  const { comingSoon } = await params;
  if (!isComingSoonSlug(comingSoon)) notFound();
  return <StaffComingSoon {...comingSoonModules[comingSoon]}/>;
}
