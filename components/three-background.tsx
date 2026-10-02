"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { intensity?: number };

export default function ThreeBackground({ intensity = 0.8 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 1.3, 9.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.BoxGeometry(0.72, 0.72, 0.13);
    const colors = [0x7c3aed, 0x06b6d4, 0xf43f5e, 0xf59e0b, 0x22c55e, 0x38bdf8];
    const cards: Array<{ mesh: THREE.Mesh; speed: number; offset: number; z: number }> = [];

    for (let i = 0; i < 12; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.11 * intensity,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 5.5, -Math.random() * 4);
      mesh.rotation.set(Math.random() * 0.8, Math.random() * 0.8, Math.random() * Math.PI);
      mesh.scale.setScalar(0.7 + Math.random() * 1.2);
      group.add(mesh);
      cards.push({ mesh, speed: 0.15 + Math.random() * 0.22, offset: Math.random() * Math.PI * 2, z: mesh.position.z });
    }

    const resize = () => {
      if (!host) return;
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();

    const render = (time: number) => {
      const t = (time - started) * 0.001;
      if (!reduced) {
        group.rotation.y = Math.sin(t * 0.08) * 0.04;
        cards.forEach((item, index) => {
          item.mesh.position.y += Math.sin(t * item.speed + item.offset) * 0.0009;
          item.mesh.rotation.z += item.speed * 0.00025;
          item.mesh.rotation.x += (index % 2 === 0 ? 1 : -1) * 0.00012;
        });
      }
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh) child.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [intensity]);

  return <div ref={ref} className="three-bg" aria-hidden="true" />;
}
