"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, root.clientWidth / root.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(root.clientWidth, root.clientHeight);
    root.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.IcosahedronGeometry(0.16, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xffe08a });

    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5);
      mesh.scale.setScalar(0.45 + Math.random() * 1.4);
      group.add(mesh);
      particles.push(mesh);
    }

    const cardGeo = new THREE.BoxGeometry(2.0, 2.6, 0.08);
    const cardMat = new THREE.MeshBasicMaterial({ color: 0xe54e62, transparent: true, opacity: 0.1 });
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.rotation.z = -0.18;
    card.position.set(4.2, 0.8, -0.8);
    group.add(card);

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      group.rotation.y = Math.sin(t * 0.13) * 0.05;
      group.rotation.x = Math.cos(t * 0.09) * 0.025;
      particles.forEach((p, i) => {
        p.position.y += Math.sin(t * 0.35 + i) * 0.0009;
        p.rotation.x += 0.0015;
        p.rotation.y += 0.001;
      });
      card.position.y = 0.8 + Math.sin(t * 0.55) * 0.12;
      card.rotation.y = Math.sin(t * 0.35) * 0.15;
      renderer.render(scene, camera);
    };

    const resize = () => {
      if (!root) return;
      camera.aspect = root.clientWidth / root.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(root.clientWidth, root.clientHeight);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else animate();
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      cardGeo.dispose();
      cardMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div aria-hidden className="three-layer" ref={ref} />;
}
