import { notFound } from "next/navigation";

import { AcademicSectionEditor } from "@/components/academic-editors";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <AcademicSectionEditor id={id} feedback={feedback} />;
}
