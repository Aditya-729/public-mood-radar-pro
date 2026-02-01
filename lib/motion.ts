import { Variants } from "framer-motion";

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const staggerChildren: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export const softBlurReveal: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: "easeOut" },
  },
};

export const glowPulse: Variants = {
  hidden: { opacity: 0.7, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 2.4,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    },
  },
};

export const hoverSpring = {
  whileHover: {
    y: -6,
    scale: 1.02,
    transition: { type: "spring", stiffness: 320, damping: 18 },
  },
};

export const shimmerSweep: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};
