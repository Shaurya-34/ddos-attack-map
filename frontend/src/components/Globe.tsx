import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import * as THREE from 'three';

function PulsingDot({ position, color }: { position: [number, number, number], color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Pulsing animation
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function AttackArc({ start, end, color }: { start: [number, number, number], end: [number, number, number], color: string }) {
  const tubeRef = useRef<THREE.Mesh>(null);

  const { curve, geometry } = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    midPoint.normalize().multiplyScalar(3);

    const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
    const geometry = new THREE.TubeGeometry(curve, 64, 0.01, 8, false);
    return { curve, geometry };
  }, [start, end]);

  // Animate the texture offset to create flowing effect
  useFrame(() => {
    if (tubeRef.current && tubeRef.current.material) {
      const material = tubeRef.current.material as THREE.MeshBasicMaterial;
      if (material.map) {
        material.map.offset.x -= 0.005; // Slower animation speed
      }
    }
  });

  // Create animated texture
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;

    // Create dashed pattern
    ctx.fillStyle = color;
    for (let i = 0; i < 64; i += 16) {
      ctx.fillRect(i, 0, 10, 8);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, [color]);

  return (
    <group>
      {/* Animated tube arc */}
      <mesh ref={tubeRef} geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glow effect */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function EarthGlobe({ attacks }: { attacks: Attack[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    // Using a free Earth texture from NASA
    return loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  const { validArcs, dots } = useMemo(() => {
    const coords = (lat: number, lon: number, radius = 2) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      return [
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      ] as [number, number, number];
    };

    const validArcs: Array<{ start: [number, number, number], end: [number, number, number], color: string }> = [];
    const dots: Array<{ position: [number, number, number], color: string }> = [];

    attacks.forEach(attack => {
      const start = coords(attack.sourceCoords.lat, attack.sourceCoords.lon);
      const end = coords(attack.targetCoords.lat, attack.targetCoords.lon);
      // Match the badge color scheme: red (high), amber (med), green (low)
      const color = attack.severity > 75 ? '#ef4444' : attack.severity > 40 ? '#fbbf24' : '#22c55e';

      // Calculate distance between start and end
      const distance = Math.sqrt(
        Math.pow(end[0] - start[0], 2) +
        Math.pow(end[1] - start[1], 2) +
        Math.pow(end[2] - start[2], 2)
      );

      // If distance is very small (same location or very close), render as dot
      if (distance < 0.1) {
        dots.push({ position: start, color });
      } else {
        validArcs.push({ start, end, color });
      }
    });

    return { validArcs, dots };
  }, [attacks]);

  return (
    <group ref={groupRef}>
      <Sphere args={[2, 64, 64]}>
        <meshStandardMaterial
          map={texture}
          roughness={0.6}
          metalness={0.1}
          emissive="#2a3a4a"
          emissiveIntensity={0.2}
        />
      </Sphere>

      {/* Subtle atmosphere glow */}
      <Sphere args={[2.05, 32, 32]}>
        <meshBasicMaterial
          color="#5a8cb0"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Valid arcs rotate with the globe */}
      {validArcs.map((arc, i) => (
        <AttackArc key={`arc-${i}`} {...arc} />
      ))}

      {/* Pulsing dots for same-location attacks */}
      {dots.map((dot, i) => (
        <PulsingDot key={`dot-${i}`} position={dot.position} color={dot.color} />
      ))}
    </group>
  );
}

interface Attack {
  sourceCoords: { lat: number; lon: number };
  targetCoords: { lat: number; lon: number };
  severity: number;
}


export function Globe({ attacks = [] }: { attacks?: Attack[] }) {
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Deep Space Background with Multiple Layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020308] via-[#050a15] to-[#0a0e1a]">

        {/* Deep gradient overlay for extra depth */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#030612]/50 to-[#000000]"></div>

        {/* Distant nebula clouds - deeper in space */}
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-1/4 right-1/3 w-[600px] h-[600px] bg-purple-900/30 rounded-full blur-[150px] animate-pulse"
            style={{ animationDuration: '12s', animationDelay: '0s' }}></div>
          <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-blue-900/25 rounded-full blur-[140px] animate-pulse"
            style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse"
            style={{ animationDuration: '14s', animationDelay: '4s' }}></div>
        </div>

        {/* Mid-layer nebula - brighter, closer */}
        <div className="absolute inset-0 opacity-35">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/25 rounded-full blur-[120px] animate-pulse"
            style={{ animationDuration: '8s' }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] animate-pulse"
            style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
          <div className="absolute top-1/3 right-1/3 w-72 h-72 bg-cyan-600/18 rounded-full blur-[90px] animate-pulse"
            style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
        </div>

        {/* Distant stars layer - smaller, dimmer */}
        <div className="absolute inset-0">
          {Array.from({ length: 150 }).map((_, i) => (
            <div
              key={`distant-${i}`}
              className="absolute bg-white/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 1 + 0.3}px`,
                height: `${Math.random() * 1 + 0.3}px`,
                opacity: Math.random() * 0.4 + 0.1,
              }}
            />
          ))}
        </div>

        {/* Medium distance stars with subtle twinkle */}
        <div className="absolute inset-0">
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={`medium-${i}`}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 1.5 + 0.5}px`,
                height: `${Math.random() * 1.5 + 0.5}px`,
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${Math.random() * 3 + 3}s`,
                opacity: Math.random() * 0.6 + 0.3,
              }}
            />
          ))}
        </div>

        {/* Close bright stars */}
        <div className="absolute inset-0">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={`close-${i}`}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 2.5 + 1}px`,
                height: `${Math.random() * 2.5 + 1}px`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 2 + 2}s`,
                opacity: Math.random() * 0.8 + 0.4,
                boxShadow: '0 0 2px rgba(255, 255, 255, 0.8)',
              }}
            />
          ))}
        </div>

        {/* Vignette effect for depth */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60"></div>
      </div>

      {/* Globe Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'relative', zIndex: 10 }}
      >
        <ambientLight intensity={0.65} />
        <pointLight position={[10, 10, 10]} intensity={1.3} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#60a5fa" />

        <EarthGlobe attacks={attacks} />

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={5}
          maxDistance={15}
          autoRotate={false}
          rotateSpeed={0.5}
        />
      </Canvas>

      <div className="absolute bottom-6 left-6 glass px-4 py-2 rounded-lg z-20">
        <p className="text-xs text-muted-foreground">
          Drag to rotate • Scroll to zoom
        </p>
      </div>
    </div>
  );
}
