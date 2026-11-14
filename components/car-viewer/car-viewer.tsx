"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { AC_PARTS, CATEGORY_COLORS, type SelectedPart } from "@/lib/ac-parts";
import { RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface CarViewerProps {
  selectedParts: SelectedPart[];
  onPartToggle: (partId: string) => void;
}

export function CarViewer({ selectedParts, onPartToggle }: CarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    hotspots: Map<string, THREE.Mesh>;
    carGroup: THREE.Group;
    autoRotate: boolean;
    mouseDown: boolean;
    lastMouse: { x: number; y: number };
    rotationY: number;
    rotationX: number;
    targetZoom: number;
  } | null>(null);
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const rafRef = useRef<number>(0);

  const selectedIds = new Set(selectedParts.map((p) => p.id));

  const buildCar = useCallback((scene: THREE.Scene): { carGroup: THREE.Group; hotspots: Map<string, THREE.Mesh> } => {
    const carGroup = new THREE.Group();
    const hotspots = new Map<string, THREE.Mesh>();

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a2e,
      metalness: 0.9,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    // Main body
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.6, 4.2, 4, 2, 4);
    const positions = bodyGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const absX = Math.abs(x);
      if (absX > 0.8) {
        positions.setY(i, y - (absX - 0.8) * 0.15);
      }
      if (z > 1.6) {
        positions.setX(i, x * (1 - (z - 1.6) * 0.15));
        positions.setY(i, y - (z - 1.6) * 0.08);
      }
      if (z < -1.6) {
        positions.setX(i, x * (1 - (-z - 1.6) * 0.1));
      }
    }
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    carGroup.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.0, 3, 2, 3);
    const cabinPos = cabinGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cabinPos.count; i++) {
      const x = cabinPos.getX(i);
      const y = cabinPos.getY(i);
      const z = cabinPos.getZ(i);
      if (y > 0.2) {
        cabinPos.setX(i, x * 0.85);
        if (z > 0.6) cabinPos.setZ(i, z - 0.15);
        if (z < -0.6) cabinPos.setZ(i, z + 0.1);
      }
    }
    cabinGeo.computeVertexNormals();
    const cabinMat = new THREE.MeshPhysicalMaterial({
      color: 0x111122,
      metalness: 0.7,
      roughness: 0.3,
      clearcoat: 0.5,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.05, -0.15);
    carGroup.add(cabin);

    // Windshield
    const windshieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.3,
      transmission: 0.6,
    });
    const windshieldGeo = new THREE.PlaneGeometry(1.4, 0.5);
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0, 1.1, 0.85);
    windshield.rotation.x = -0.45;
    carGroup.add(windshield);

    // Rear window
    const rearWindow = new THREE.Mesh(windshieldGeo, windshieldMat);
    rearWindow.position.set(0, 1.1, -1.1);
    rearWindow.rotation.x = 0.35;
    carGroup.add(rearWindow);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
    const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.2, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 1, roughness: 0.2 });

    const wheelPositions = [
      { x: -1.05, y: 0.3, z: 1.2 },
      { x: 1.05, y: 0.3, z: 1.2 },
      { x: -1.05, y: 0.3, z: -1.2 },
      { x: 1.05, y: 0.3, z: -1.2 },
    ];

    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.rotation.z = Math.PI / 2;
      carGroup.add(wheel);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(pos.x, pos.y, pos.z);
      rim.rotation.z = Math.PI / 2;
      carGroup.add(rim);
    }

    // Headlights
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
    });
    const headlightGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const hl1 = new THREE.Mesh(headlightGeo, headlightMat);
    hl1.position.set(-0.65, 0.55, 2.1);
    hl1.scale.set(1, 0.6, 0.4);
    carGroup.add(hl1);
    const hl2 = new THREE.Mesh(headlightGeo, headlightMat);
    hl2.position.set(0.65, 0.55, 2.1);
    hl2.scale.set(1, 0.6, 0.4);
    carGroup.add(hl2);

    // Tail lights
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff0000,
      emissiveIntensity: 0.4,
    });
    const tl1 = new THREE.Mesh(headlightGeo, tailMat);
    tl1.position.set(-0.65, 0.55, -2.1);
    tl1.scale.set(1, 0.6, 0.4);
    carGroup.add(tl1);
    const tl2 = new THREE.Mesh(headlightGeo, tailMat);
    tl2.position.set(0.65, 0.55, -2.1);
    tl2.scale.set(1, 0.6, 0.4);
    carGroup.add(tl2);

    // Grille
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.3 });
    const grilleGeo = new THREE.BoxGeometry(1.3, 0.25, 0.05);
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, 0.4, 2.1);
    carGroup.add(grille);

    // Ground shadow
    const shadowGeo = new THREE.PlaneGeometry(3, 5.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    carGroup.add(shadow);

    // AC Component hotspots
    for (const part of AC_PARTS) {
      const color = CATEGORY_COLORS[part.category];
      const hotspotGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const hotspotMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.7,
      });
      const hotspot = new THREE.Mesh(hotspotGeo, hotspotMat);
      hotspot.position.set(part.position.x, part.position.y, part.position.z);
      hotspot.userData = { partId: part.id };
      carGroup.add(hotspot);
      hotspots.set(part.id, hotspot);

      // Ring around hotspot
      const ringGeo = new THREE.RingGeometry(0.14, 0.17, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(hotspot.position);
      carGroup.add(ring);
    }

    scene.add(carGroup);
    return { carGroup, hotspots };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.08);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(4, 2.5, 4);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.3);
    rimLight.position.set(0, 5, -8);
    scene.add(rimLight);

    // Ground grid
    const gridHelper = new THREE.GridHelper(12, 24, 0x1a1a3a, 0x111125);
    scene.add(gridHelper);

    const { carGroup, hotspots } = buildCar(scene);

    const state = {
      scene,
      camera,
      renderer,
      hotspots,
      carGroup,
      autoRotate: true,
      mouseDown: false,
      lastMouse: { x: 0, y: 0 },
      rotationY: 0,
      rotationX: 0,
      targetZoom: 5.5,
    };
    sceneRef.current = state;

    // Raycaster for clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function getHotspotAtMouse(event: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(hotspots.values());
      const intersects = raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        return intersects[0]!.object.userData.partId as string;
      }
      return null;
    }

    function onMouseMove(event: MouseEvent) {
      const partId = getHotspotAtMouse(event);
      setHoveredPart(partId);
      container!.style.cursor = partId ? "pointer" : "grab";

      if (state.mouseDown) {
        const dx = event.clientX - state.lastMouse.x;
        const dy = event.clientY - state.lastMouse.y;
        state.rotationY += dx * 0.005;
        state.rotationX += dy * 0.003;
        state.rotationX = Math.max(-0.5, Math.min(0.5, state.rotationX));
        state.lastMouse = { x: event.clientX, y: event.clientY };
      }
    }

    function onMouseDown(event: MouseEvent) {
      state.mouseDown = true;
      state.lastMouse = { x: event.clientX, y: event.clientY };
      container!.style.cursor = "grabbing";
    }

    function onMouseUp(event: MouseEvent) {
      if (!state.mouseDown) return;
      const dx = Math.abs(event.clientX - state.lastMouse.x);
      const dy = Math.abs(event.clientY - state.lastMouse.y);
      state.mouseDown = false;

      if (dx < 5 && dy < 5) {
        const partId = getHotspotAtMouse(event);
        if (partId) onPartToggle(partId);
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      state.targetZoom += event.deltaY * 0.005;
      state.targetZoom = Math.max(3, Math.min(10, state.targetZoom));
    }

    // Touch events
    let touchStart = { x: 0, y: 0 };
    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 1) {
        touchStart = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
        state.lastMouse = { ...touchStart };
        state.mouseDown = true;
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (event.touches.length === 1 && state.mouseDown) {
        const dx = event.touches[0]!.clientX - state.lastMouse.x;
        const dy = event.touches[0]!.clientY - state.lastMouse.y;
        state.rotationY += dx * 0.005;
        state.rotationX += dy * 0.003;
        state.rotationX = Math.max(-0.5, Math.min(0.5, state.rotationX));
        state.lastMouse = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
      }
    }

    function onTouchEnd(event: TouchEvent) {
      state.mouseDown = false;
      if (event.changedTouches.length === 1) {
        const dx = Math.abs(event.changedTouches[0]!.clientX - touchStart.x);
        const dy = Math.abs(event.changedTouches[0]!.clientY - touchStart.y);
        if (dx < 10 && dy < 10) {
          const rect = container!.getBoundingClientRect();
          mouse.x = ((event.changedTouches[0]!.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.changedTouches[0]!.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          const meshes = Array.from(hotspots.values());
          const intersects = raycaster.intersectObjects(meshes);
          if (intersects.length > 0) {
            onPartToggle(intersects[0]!.object.userData.partId as string);
          }
        }
      }
    }

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mouseup", onMouseUp);
    container.addEventListener("mouseleave", () => { state.mouseDown = false; });
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd);

    // Animation
    let time = 0;
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      time += 0.016;

      if (state.autoRotate && !state.mouseDown) {
        state.rotationY += 0.003;
      }

      carGroup.rotation.y = state.rotationY;
      carGroup.rotation.x = state.rotationX;

      // Camera zoom
      const currentDist = camera.position.length();
      const targetDist = state.targetZoom;
      const newDist = currentDist + (targetDist - currentDist) * 0.05;
      camera.position.normalize().multiplyScalar(newDist);
      camera.lookAt(0, 0.5, 0);

      // Animate hotspots
      for (const [partId, mesh] of hotspots) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const isSelected = selectedIds.has(partId);
        const isHovered = hoveredPart === partId;

        const pulse = Math.sin(time * 3) * 0.03;
        mesh.scale.setScalar(isSelected ? 1.4 + pulse : isHovered ? 1.2 : 1.0);
        mat.opacity = isSelected ? 1.0 : isHovered ? 0.9 : 0.6;

        if (isSelected) {
          mat.color.setHex(0x00f0ff);
        } else {
          const part = AC_PARTS.find(p => p.id === partId);
          if (part) mat.color.set(CATEGORY_COLORS[part.category]);
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    // Resize
    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildCar, onPartToggle]);

  // Update hotspot visuals when selection changes
  useEffect(() => {
    if (!sceneRef.current) return;
    const { hotspots } = sceneRef.current;
    for (const [partId, mesh] of hotspots) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (selectedIds.has(partId)) {
        mat.color.setHex(0x00f0ff);
        mesh.scale.setScalar(1.4);
      } else {
        const part = AC_PARTS.find(p => p.id === partId);
        if (part) mat.color.set(CATEGORY_COLORS[part.category]);
        mesh.scale.setScalar(1.0);
      }
    }
  }, [selectedParts, selectedIds]);

  function toggleAutoRotate() {
    setAutoRotate((prev) => {
      const next = !prev;
      if (sceneRef.current) sceneRef.current.autoRotate = next;
      return next;
    });
  }

  function zoomIn() {
    if (sceneRef.current) {
      sceneRef.current.targetZoom = Math.max(3, sceneRef.current.targetZoom - 1);
    }
  }

  function zoomOut() {
    if (sceneRef.current) {
      sceneRef.current.targetZoom = Math.min(10, sceneRef.current.targetZoom + 1);
    }
  }

  function resetView() {
    if (sceneRef.current) {
      sceneRef.current.rotationY = 0;
      sceneRef.current.rotationX = 0;
      sceneRef.current.targetZoom = 5.5;
      sceneRef.current.autoRotate = true;
      setAutoRotate(true);
    }
  }

  const hoveredPartData = hoveredPart ? AC_PARTS.find((p) => p.id === hoveredPart) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-dark-900">
        <div ref={containerRef} className="aspect-[16/10] w-full" />

        {/* Controls */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            onClick={toggleAutoRotate}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
              autoRotate
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                : "bg-dark-700/80 text-text-secondary border border-border hover:text-text-primary"
            }`}
            title="Rotação automática"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={zoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-700/80 text-text-secondary border border-border hover:text-text-primary transition-all"
            title="Zoom +"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={zoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-700/80 text-text-secondary border border-border hover:text-text-primary transition-all"
            title="Zoom -"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetView}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-700/80 text-text-secondary border border-border hover:text-text-primary transition-all"
            title="Resetar visualização"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Hovered part tooltip */}
        {hoveredPartData && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg glass px-3 py-2 animate-[fade-in_150ms]">
            <p className="text-sm font-semibold text-text-primary">{hoveredPartData.name}</p>
            <p className="text-xs text-text-secondary">{hoveredPartData.description}</p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 rounded-lg glass px-3 py-2">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-text-muted">Categorias</p>
          <div className="flex flex-col gap-1">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-text-secondary capitalize">{cat}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-0.5 pt-0.5 border-t border-border">
              <span className="h-2 w-2 rounded-full bg-neon-cyan" />
              <span className="text-[11px] text-neon-cyan">Selecionado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Part selection grid */}
      <div className="rounded-xl border border-border bg-dark-900 p-4">
        <h3 className="mb-3 font-display text-lg tracking-wider text-text-primary">
          COMPONENTES DO A/C
        </h3>
        <p className="mb-4 text-xs text-text-muted">
          Clique nos pontos no carro 3D ou selecione abaixo os componentes com defeito
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {AC_PARTS.map((part) => {
            const isSelected = selectedIds.has(part.id);
            return (
              <button
                key={part.id}
                onClick={() => onPartToggle(part.id)}
                className={`group relative flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? "border-neon-cyan/40 bg-neon-cyan/10 shadow-glow-sm"
                    : "border-border bg-dark-800 hover:border-dark-400 hover:bg-surface-hover"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: isSelected ? "#00f0ff" : CATEGORY_COLORS[part.category] }}
                  />
                  {isSelected && (
                    <span className="text-[10px] font-bold text-neon-cyan">SELECIONADO</span>
                  )}
                </div>
                <span className={`mt-2 text-sm font-medium ${isSelected ? "text-neon-cyan" : "text-text-primary"}`}>
                  {part.name}
                </span>
                <span className="mt-0.5 text-[11px] text-text-muted line-clamp-2">
                  {part.description}
                </span>
                <span className="mt-2 text-xs tabular text-text-secondary">
                  R$ {part.defaultPrice.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
