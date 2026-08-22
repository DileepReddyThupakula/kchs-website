import { notFound } from "next/navigation";

import { AcademicClassDetail } from "@/components/academic-management";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <AcademicClassDetail classId={id} feedback={feedback} />;
}
