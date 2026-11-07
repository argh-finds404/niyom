"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import * as THREE from "three";

/**
 * Three.js WebGL procedural archival coordinate mesh & intaglio wave field.
 * Renders a subtle 3D copperplate ledger grid and vertex ticks that tilt and
 * undulate with scroll depth, scroll velocity, and pointer parallax.
 * Automatically degrades gracefully in headless/non-WebGL or reduced-motion environments.
 */
function ThreeArchivalField() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || typeof window === "undefined") return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      // WebGL context unavailable (e.g. headless test runner); skip cleanly.
      return;
    }

    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 9.5);

    const group = new THREE.Group();
    group.rotation.x = -0.52;
    scene.add(group);

    // Build a procedural 3D intaglio ledger grid (cols x rows)
    const cols = 34;
    const rows = 20;
    const spanX = 16;
    const spanZ = 10;
    const basePositions: number[] = [];
    const lineIndices: number[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c / (cols - 1) - 0.5) * spanX;
        const z = (r / (rows - 1) - 0.5) * spanZ;
        basePositions.push(x, 0, z);

        const idx = r * cols + c;
        if (c < cols - 1) {
          lineIndices.push(idx, idx + 1);
        }
        if (r < rows - 1) {
          lineIndices.push(idx, idx + cols);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.Float32BufferAttribute(basePositions, 3);
    geometry.setAttribute("position", positionAttr);
    geometry.setIndex(lineIndices);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x1c1b19,
      transparent: true,
      opacity: 0.042,
    });
    const gridLines = new THREE.LineSegments(geometry, lineMaterial);
    group.add(gridLines);

    const pointsMaterial = new THREE.PointsMaterial({
      color: 0x1c1b19,
      size: 0.045,
      transparent: true,
      opacity: 0.085,
    });
    const gridPoints = new THREE.Points(geometry, pointsMaterial);
    group.add(gridPoints);

    // Subtle orbital calibration rings in 3D space
    const ringGeo = new THREE.RingGeometry(2.4, 2.42, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1c1b19,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.035,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(2.6, 0.6, -1.2);
    ringMesh.rotation.x = 0.35;
    scene.add(ringMesh);

    let scrollY = window.scrollY;
    let lastScrollY = scrollY;
    let scrollBoost = 0;
    let pointerX = 0;
    let pointerY = 0;
    let rafId = 0;
    let phase = 0;

    const onScroll = () => {
      const next = window.scrollY;
      const delta = Math.abs(next - lastScrollY);
      lastScrollY = next;
      scrollY = next;
      scrollBoost = Math.min(1.8, scrollBoost + delta * 0.008);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 0.65;
      pointerY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 0.45;
    };

    const onResize = () => {
      if (!renderer) return;
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 800;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      scrollBoost *= 0.93;
      phase += 0.008 + scrollBoost * 0.014;

      const pos = geometry.attributes.position as THREE.BufferAttribute;
      const count = pos.count;
      const scrollOffset = scrollY * 0.0022;

      for (let i = 0; i < count; i++) {
        const bx = basePositions[i * 3];
        const bz = basePositions[i * 3 + 2];
        const wave =
          Math.sin(bx * 0.48 + phase + scrollOffset) * 0.22 +
          Math.cos(bz * 0.62 - phase * 0.8 + scrollOffset) * 0.16;
        pos.setY(i, wave * (1 + scrollBoost * 0.35));
      }
      pos.needsUpdate = true;

      group.rotation.z = Math.sin(phase * 0.35) * 0.03 + pointerX * 0.05;
      group.rotation.x = -0.52 + Math.min(0.18, scrollY * 0.00008) + pointerY * 0.04;
      ringMesh.rotation.z = phase * 0.25 + scrollOffset * 0.4;

      camera.position.x += (pointerX - camera.position.x) * 0.04;
      camera.position.y += (1.8 - pointerY * 0.5 - camera.position.y) * 0.04;
      camera.lookAt(0, -0.2, 0);

      renderer?.render(scene, camera);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
      geometry.dispose();
      lineMaterial.dispose();
      pointsMaterial.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer?.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}

/**
 * Scroll-reactive archival background videography, Framer Motion spring camera flow,
 * and Three.js 3D copperplate ledger field.
 *
 * Combines:
 * 1. Three.js WebGL procedural 3D topographical ledger grid (`ThreeArchivalField`)
 * 2. Primary intaglio engraved motion video (`/media/archive-engraving-loop.mp4`)
 *    with Gemini copperplate architectural poster (`/media/archive-plate.jpg`)
 *    and Framer Motion (`useScroll`, `useVelocity`, `useSpring`, `useTransform`) camera drift.
 * 3. Secondary counter-parallax editorial ledger reel (`/media/editorial-ledger-reel.mp4`)
 *    for multi-plane documentary videography depth as the applicant scrolls.
 */
export function AmbientFlow() {
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 85,
    damping: 26,
    mass: 0.6,
  });
  const smoothVelocity = useSpring(scrollVelocity, {
    stiffness: 120,
    damping: 30,
  });

  // Framer Motion spring-interpolated videography camera transforms
  const primaryY = useTransform(smoothScrollY, [0, 3000], ["0px", "-135px"]);
  const primaryScale = useTransform(smoothScrollY, [0, 2400], [1.02, 1.08]);
  const secondaryY = useTransform(smoothScrollY, [0, 3000], ["0px", "95px"]);
  const secondaryRotate = useTransform(smoothVelocity, [-1500, 0, 1500], [-0.8, 0, 0.8]);
  const svgY = useTransform(smoothScrollY, [0, 3000], ["0px", "-75px"]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const v1 = primaryVideoRef.current;
    const v2 = secondaryVideoRef.current;
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (const v of [v1, v2]) {
      if (!v) continue;
      if (reducedMotion) {
        v.pause();
      } else {
        v.playbackRate = 0.65;
        void v.play().catch(() => {
          // Autoplay may be blocked in headless/test environments; poster image remains visible.
        });
      }
    }

    let raf = 0;
    let settleTimer: number | undefined;
    let lastY = window.scrollY;

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const delta = Math.abs(y - lastY);
      lastY = y;
      root.style.setProperty("--scroll-y", `${Math.round(y)}px`);

      if (!reducedMotion) {
        const boost = Math.min(1.75, 0.65 + delta * 0.02);
        if (v1 && !v1.paused) v1.playbackRate = boost;
        if (v2 && !v2.paused) v2.playbackRate = Math.min(1.5, 0.55 + delta * 0.015);
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          if (v1 && !v1.paused) v1.playbackRate = 0.65;
          if (v2 && !v2.paused) v2.playbackRate = 0.55;
        }, 180);
      }
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none print:hidden"
    >
      {/* Layer 1: Three.js WebGL 3D Archival Coordinate Mesh */}
      <ThreeArchivalField />

      {/* Layer 2: Primary Framer Motion spring videography plane (Intaglio engraving + Gemini plate) */}
      <motion.div
        className="absolute inset-x-0 -top-28 h-[135vh] opacity-[0.052] mix-blend-multiply will-change-transform"
        style={{
          y: primaryY,
          scale: primaryScale,
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 75% at 62% 38%, rgba(0,0,0,1) 20%, rgba(0,0,0,0.45) 65%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 85% 75% at 62% 38%, rgba(0,0,0,1) 20%, rgba(0,0,0,0.45) 65%, transparent 100%)",
        }}
      >
        <video
          ref={primaryVideoRef}
          src="/media/archive-engraving-loop.mp4"
          poster="/media/archive-plate.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Layer 3: Secondary counter-parallax documentary ledger videography plane */}
      <motion.div
        className="absolute -bottom-24 right-[-6%] h-[78vh] w-[68vw] opacity-[0.038] mix-blend-multiply will-change-transform"
        style={{
          y: secondaryY,
          rotate: secondaryRotate,
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 70% at 55% 55%, rgba(0,0,0,0.95) 15%, rgba(0,0,0,0.35) 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 75% 70% at 55% 55%, rgba(0,0,0,0.95) 15%, rgba(0,0,0,0.35) 60%, transparent 100%)",
        }}
      >
        <video
          ref={secondaryVideoRef}
          src="/media/editorial-ledger-reel.mp4"
          poster="/media/archive-plate.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Layer 4: Scroll-driven intaglio guilloché & archival ledger curves */}
      <motion.svg
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full text-ink/[0.045] will-change-transform"
        style={{ y: svgY }}
      >
        <g stroke="currentColor" strokeWidth="1">
          <path
            d="M-120 180 C 320 60, 760 320, 1560 140"
            strokeDasharray="6 8"
          />
          <path d="M-120 210 C 340 90, 780 350, 1560 170" opacity="0.65" />
          <path d="M-120 520 C 420 660, 920 360, 1560 540" opacity="0.55" />
          <path
            d="M-120 555 C 440 695, 940 395, 1560 575"
            strokeDasharray="3 7"
            opacity="0.45"
          />
          <circle cx="1180" cy="240" r="220" opacity="0.4" />
          <circle
            cx="1180"
            cy="240"
            r="265"
            strokeDasharray="4 6"
            opacity="0.35"
          />
          <circle cx="1180" cy="240" r="310" opacity="0.25" />
          <line x1="1180" y1="0" x2="1180" y2="900" opacity="0.22" />
          <line x1="0" y1="240" x2="1440" y2="240" opacity="0.18" />
        </g>
      </motion.svg>
    </div>
  );
}
