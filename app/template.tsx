"use client";

import { motion } from "framer-motion";

const variants = {
  initial: {
    opacity: 0,
    y: 20,
    filter: "blur(10px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: 20,
    filter: "blur(10px)",
  },
};

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.5,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}
