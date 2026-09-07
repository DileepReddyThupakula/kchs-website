"use client";

import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";

export function AcademicSubmitButton({ children, className, disabled = false }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <motion.button
      className={className}
      type="submit"
      disabled={pending || disabled}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      whileDrag={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      {pending ? "Saving…" : children}
    </motion.button>
  );
}
