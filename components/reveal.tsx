"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export default function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion();
  const controls = useAnimationControls();
  const played = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      controls.stop();
      controls.set({ y: 0 });
    }
  }, [controls, reducedMotion]);

  return (
    <motion.div
      className={`reveal ${className}`}
      initial={false}
      animate={controls}
      viewport={{ once: true, amount: 0.1 }}
      onViewportEnter={() => {
        if (played.current) return;
        played.current = true;
        // Content is always visible; Motion is the only transform owner.
        if (reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        void controls.start({
          y: [10, 0],
          transition: { duration: 0.36, delay: Math.min(Math.max(delay, 0), 120) / 1000, ease: [0.2, 0.8, 0.2, 1] },
        });
      }}
    >
      {children}
    </motion.div>
  );
}
