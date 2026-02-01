import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const particles = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  size: 6 + (index % 5) * 2,
  left: `${(index * 7) % 100}%`,
  top: `${(index * 11) % 100}%`,
  delay: index * 0.4,
}));

export function FloatingParticles({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0", className)}>
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-full bg-white/10 blur-sm"
          style={{
            width: particle.size,
            height: particle.size,
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            y: [0, -12, 0],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 6 + particle.id,
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}
