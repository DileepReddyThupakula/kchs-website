"use client";

import { useFormStatus } from "react-dom";

export function AcademicSubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending}>{pending ? "Saving…" : children}</button>;
}
