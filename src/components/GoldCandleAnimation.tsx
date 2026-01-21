"use client";

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, Sparkles } from '@react-three/drei';

/**
 * A background field of large, slow-moving gold particles.
 */
const BackgroundParticles = () => {
  return (
    <group>
      {/* Very large, slow background particles for depth */}
      <Sparkles 
        count={50}
        scale={[30, 30, 30]}
        size={25} 
        speed={0.2} 
        opacity={0.3}
        color="#C5A021" // Deep, rich gold
        noise={0.1}
      />
       {/* Medium, brighter particles for highlights */}
       <Sparkles 
        count={120}
        scale={[25, 25, 25]}
        size={12} 
        speed={0.4} 
        opacity={0.8}
        color="#FFD700" // Bright metallic gold
        noise={0.2}
      />
    </group>
  );
}

export default function GoldCandleAnimation() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 20], fov: 60 }} gl={{ antialias: true }}>
        {/* Dark slate background to blend with the page */}
        <color attach="background" args={["#020617"]} />
        {/* Fog to fade distant particles into darkness */}
        <fog attach="fog" args={["#020617", 5, 35]} />

        {/* Warm, dramatic lighting to make the gold pop */}
        <ambientLight intensity={0.3} color="#FFD700" />
        <pointLight position={[15, 15, 15]} intensity={2} color="#FFD700" distance={50} decay={2} />
        <spotLight position={[-15, 20, 0]} angle={0.3} penumbra={1} intensity={2} color="#FFECB3" castShadow />

        {/* Gently floating particle field */}
        <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.2}>
          <BackgroundParticles />
        </Float>

        {/* City environment for metallic reflections on particles */}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}