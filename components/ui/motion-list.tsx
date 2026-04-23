"use client";

import { Children, type ReactNode } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

export function MotionList({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div className={clsx(className)} style={style} variants={container} initial="hidden" animate="show">
      {Children.map(children, (child) => (
        <motion.div variants={item} style={{ willChange: "transform, opacity" }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
