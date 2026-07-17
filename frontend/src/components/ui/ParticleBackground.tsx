"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  duration: number;
  delay: number;
  // Add animation paths to prevent regeneration
  animationX: number[];
  animationY: number[];
  animationOpacity: number[];
}

interface ParticleBackgroundProps {
  count?: number;
  colors?: string[];
  minSize?: number;
  maxSize?: number;
  speed?: number;
}

export default function ParticleBackground({
  count = 50,
  colors = ["#FFCA40", "#6A98F0", "#ffffff"],
  minSize = 2,
  maxSize = 8,
  speed = 1,
}: ParticleBackgroundProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles only once on mount, or when core parameters change
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      // Pre-generate animation values to prevent re-calculation on every render
      const baseOpacity = Math.random() * 0.7 + 0.1;
      newParticles.push({
        id: i,
        x: Math.random() * 100, // position as percentage of screen
        y: Math.random() * 100,
        size: Math.random() * (maxSize - minSize) + minSize,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: baseOpacity,
        duration: (Math.random() * 50 + 10) / speed, // between 10-30s, adjusted by speed
        delay: Math.random() * -20, // some particles will be mid-animation on load
        // Pre-generate stable animation paths
        animationX: [
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
        ],
        animationY: [
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
          Math.random() * 100 - 50,
        ],
        animationOpacity: [
          baseOpacity,
          baseOpacity * 1.5,
          baseOpacity,
          baseOpacity * 0.7,
          baseOpacity,
        ],
      });
    }
    setParticles(newParticles);
    // Intentionally excluding 'colors' from dependencies to prevent re-generation on parent re-renders
    // Colors are captured at generation time and don't need to trigger regeneration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, minSize, maxSize, speed]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-5]">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            filter: `blur(${particle.size / 2}px)`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.size / 2}px ${particle.color}`,
          }}
          animate={{
            x: particle.animationX,
            y: particle.animationY,
            opacity: particle.animationOpacity,
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}