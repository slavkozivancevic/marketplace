"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { HERO_IMAGE_URL } from "./hero-image";

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      fadeSpeed: number;
      color: number;
    }

    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const createParticles = () => {
      const area = canvas.offsetWidth * canvas.offsetHeight;
      const count = Math.min(Math.floor(area / 8000), 120);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          size: Math.random() * 2.5 + 0.8,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: (Math.random() - 0.5) * 0.4,
          opacity: Math.random() * 0.6 + 0.2,
          fadeSpeed: Math.random() * 0.008 + 0.003,
          color: Math.floor(Math.random() * 3),
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      const classList = document.documentElement.classList;
      const isCosmos = classList.contains("cosmos");
      const isDark = classList.contains("dark");

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity += p.fadeSpeed;

        if (p.opacity >= 0.85 || p.opacity <= 0.1) {
          p.fadeSpeed *= -1;
        }

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (isCosmos) {
          const colors = [
            `rgba(180, 150, 255, ${p.opacity})`,
            `rgba(255, 190, 90, ${p.opacity * 0.9})`,
            `rgba(255, 140, 60, ${p.opacity * 0.7})`,
          ];
          ctx.fillStyle = colors[p.color];
        } else if (isDark) {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.6})`;
        } else {
          ctx.fillStyle = `rgba(60, 60, 80, ${p.opacity * 0.35})`;
        }

        ctx.fill();
      }

      // Connecting lines
      const maxDist = 150;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = dx * dx + dy * dy;

          if (dist < maxDist * maxDist) {
            const lineOpacity = (1 - Math.sqrt(dist) / maxDist) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);

            if (isCosmos) {
              ctx.strokeStyle = `rgba(160, 130, 255, ${lineOpacity * 2.5})`;
            } else if (isDark) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity * 1.5})`;
            } else {
              ctx.strokeStyle = `rgba(60, 60, 80, ${lineOpacity * 1.2})`;
            }
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    draw();

    const handleResize = () => {
      resize();
      createParticles();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      {/* Fixed background image - grayscale, low opacity, parallax */}
      <div className="fixed inset-0 -z-10">
        <Image
          src={HERO_IMAGE_URL}
          alt=""
          fill
          className="object-cover grayscale opacity-[0.08] dark:opacity-[0.05] cosmos:grayscale-40 cosmos:opacity-[0.07] cosmos:hue-rotate-220 scale-110"
          sizes="100vw"
          priority
          unoptimized
        />
      </div>

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-1"
        aria-hidden="true"
      />
    </>
  );
}
