"use client";

import { motion } from "framer-motion";

export function SkeletonLoader({
  width = "100%",
  height = "16px",
  radius = "4px",
  count = 1,
  gap = "12px"
}: {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  count?: number;
  gap?: string | number;
}) {
  return (
    <motion.div
      className="skeleton-loader-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div
        className="skeleton-loader-content"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: typeof gap === "number" ? `${gap}px` : gap,
          width: typeof width === "number" ? `${width}px` : width
        }}
      >
        {Array.from({ length: count }).map((_, index) => (
          <motion.div
            key={index}
            className="skeleton-item"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: 1.5,
              delay: index * 0.2,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              height: typeof height === "number" ? `${height}px` : height,
              background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
              backgroundSize: "200% 100%",
              borderRadius: typeof radius === "number" ? `${radius}px` : radius,
              animation: "loading 1.5s ease-in-out infinite"
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}