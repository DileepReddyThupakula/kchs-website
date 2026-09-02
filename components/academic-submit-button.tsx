"use client";

import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";

export function AcademicSubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <motion.button
      className={className}
      type="submit"
      disabled={pending}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      whileDrag={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      {pending ? "Saving…" : children}
    </motion.button>
  );
}
