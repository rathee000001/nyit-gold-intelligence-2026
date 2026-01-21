"use client";

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface GoldParticle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
}

interface FactorAtomHudProps {
  label: string;
  value: string;
  isActive?: boolean;
}

export default function FactorAtomHud({ label, value, isActive = false }: FactorAtomHudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: GoldParticle[] = [];
    const particleCount = 12;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const createParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 0.5,
          speed: Math.random() * 0.4 + 0.1,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Render Gold Atoms
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.opacity})`; // Gold Color Hex
        ctx.fill();

        p.y += p.speed;
        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });

      requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    draw();

    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`relative h-28 bg-white border ${isActive ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-slate-100 shadow-sm'} rounded-3xl overflow-hidden transition-all duration-500`}
    >
      {/* Falling Gold Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />
      
      {/* HUD Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 text-center">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
          {label}
        </span>
        <div className="flex flex-col">
          <span className="text-xl font-black text-slate-900 tracking-tighter tabular-nums">
            {value}
          </span>
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className={`h-1 w-1 rounded-full ${isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-200'}`} />
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">
              LIVE_SYNC
            </span>
          </div>
        </div>
      </div>
      
      {/* Bottom Gloss Overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-50/50 to-transparent pointer-events-none" />
    </motion.div>
  );
}