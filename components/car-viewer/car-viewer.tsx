"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AC_PARTS, CATEGORY_COLORS, type SelectedPart } from "@/lib/ac-parts";
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Loader2 } from "lucide-react";

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
  const [modelLoading, setModelLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const rafRef = useRef<number>(0);

  const selectedIds = new Set(selectedParts.map((p) => p.id));

  const addHotspots = useCallback(
    (
      carGroup: THREE.Group,
      modelBounds: { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; center: THREE.Vector3 },
    ): Map<string, THREE.Mesh> => {
      const hotspots = new Map<string, THREE.Mesh>();
      const { size, center } = modelBounds;
      const carLength = size.x;
      const carHeight = size.y;
      const carWidth = size.z;

      // Map AC part positions relative to the car bounding box
      // x = length axis (front=negative, rear=positive in our setup)
      // y = height
      // z = width (left/right)
      const partPositions: Record<string, { x: number; y: number; z: number }> = {
        "compressor": { x: -carLength * 0.25, y: carHeight * 0.25, z: carWidth * 0.2 },
        "condensador": { x: -carLength * 0.42, y: carHeight * 0.25, z: 0 },
        "evaporador": { x: -carLength * 0.05, y: carHeight * 0.5, z: 0 },
        "valvula-expansao": { x: -carLength * 0.08, y: carHeight * 0.4, z: carWidth * 0.15 },
        "filtro-secador": { x: -carLength * 0.32, y: carHeight * 0.35, z: -carWidth * 0.18 },
        "embreagem-compressor": { x: -carLength * 0.28, y: carHeight * 0.18, z: carWidth * 0.25 },
        "motor-ventilador": { x: -carLength * 0.02, y: carHeight * 0.45, z: -carWidth * 0.1 },
        "mangueiras": { x: -carLength * 0.18, y: carHeight * 0.3, z: -carWidth * 0.12 },
        "pressostato": { x: -carLength * 0.3, y: carHeight * 0.4, z: carWidth * 0.1 },
        "ventoinha-condensador": { x: -carLength * 0.4, y: carHeight * 0.2, z: carWidth * 0.05 },
        "gas-refrigerante": { x: -carLength * 0.2, y: carHeight * 0.3, z: carWidth * 0.2 },
        "painel-controle": { x: 0, y: carHeight * 0.55, z: 0 },
      };

      for (const part of AC_PARTS) {
        const color = CATEGORY_COLORS[part.category];
        const pos = partPositions[part.id] ?? { x: 0, y: 0.3, z: 0 };

        // Hotspot sphere
        const radius = carLength * 0.02;
        const hotspotGeo = new THREE.SphereGeometry(radius, 16, 16);
        const hotspotMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.8,
          depthTest: false,
        });
        const hotspot = new THREE.Mesh(hotspotGeo, hotspotMat);
        hotspot.position.set(pos.x, pos.y, pos.z);
        hotspot.userData = { partId: part.id };
        hotspot.renderOrder = 999;
        carGroup.add(hotspot);
        hotspots.set(part.id, hotspot);

        // Pulsing ring
        const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthTest: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(hotspot.position);
        ring.renderOrder = 998;
        carGroup.add(ring);
      }

      return hotspots;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.04);

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.01,
      200,
    );
    camera.position.set(4, 2.5, 4);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 10, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.3);
    rimLight.position.set(0, 6, -10);
    scene.add(rimLight);

    const bottomLight = new THREE.HemisphereLight(0x222244, 0x111111, 0.3);
    scene.add(bottomLight);

    // Ground grid
    const gridHelper = new THREE.GridHelper(20, 40, 0x1a1a3a, 0x111125);
    scene.add(gridHelper);

    // Ground reflection
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0e,
      metalness: 0.7,
      roughness: 0.35,
      transparent: true,
      opacity: 0.5,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Load GLTF model
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/",
    );
    loader.setDRACOLoader(dracoLoader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    let hotspots = new Map<string, THREE.Mesh>();

    loader.load(
      "/models/creta.glb",
      (gltf) => {
        const model = gltf.scene;

        // Compute bounding box
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center model and place on ground
        model.position.x = -center.x;
        model.position.y = -box.min.y;
        model.position.z = -center.z;

        // Improve materials for dark theme
        model.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat.isMeshStandardMaterial) {
              mat.envMapIntensity = 1.5;
              mat.needsUpdate = true;
            }
          }
        });

        carGroup.add(model);

        // Recalculate bounds after positioning
        const newBox = new THREE.Box3().setFromObject(carGroup);
        const newSize = newBox.getSize(new THREE.Vector3());
        const newCenter = newBox.getCenter(new THREE.Vector3());

        // Add hotspots relative to model bounds
        hotspots = addHotspots(carGroup, {
          min: newBox.min,
          max: newBox.max,
          size: newSize,
          center: newCenter,
        });

        // Adjust camera distance based on model size
        const maxDim = Math.max(newSize.x, newSize.y, newSize.z);
        const cameraDistance = maxDim * 1.8;
        state.targetZoom = cameraDistance;
        camera.position.set(cameraDistance * 0.7, cameraDistance * 0.4, cameraDistance * 0.7);
        camera.lookAt(0, newSize.y * 0.3, 0);

        // Update state with hotspots
        state.hotspots = hotspots;

        setModelLoading(false);
      },
      (progress) => {
        if (progress.total > 0) {
          setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      (error) => {
        console.error("Error loading model:", error);
        setModelLoading(false);
      },
    );

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
      targetZoom: 6,
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
      const meshes = Array.from(state.hotspots.values());
      if (meshes.length === 0) return null;
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
      state.targetZoom = Math.max(2, Math.min(15, state.targetZoom));
    }

    // Touch events
    let touchStart = { x: 0, y: 0 };
    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 1) {
        touchStart = {
          x: event.touches[0]!.clientX,
          y: event.touches[0]!.clientY,
        };
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
        state.lastMouse = {
          x: event.touches[0]!.clientX,
          y: event.touches[0]!.clientY,
        };
      }
    }

    function onTouchEnd(event: TouchEvent) {
      state.mouseDown = false;
      if (event.changedTouches.length === 1) {
        const dx = Math.abs(event.changedTouches[0]!.clientX - touchStart.x);
        const dy = Math.abs(event.changedTouches[0]!.clientY - touchStart.y);
        if (dx < 10 && dy < 10) {
          const rect = container!.getBoundingClientRect();
          mouse.x =
            ((event.changedTouches[0]!.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y =
            -((event.changedTouches[0]!.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          const meshes = Array.from(state.hotspots.values());
          if (meshes.length > 0) {
            const intersects = raycaster.intersectObjects(meshes);
            if (intersects.length > 0) {
              onPartToggle(intersects[0]!.object.userData.partId as string);
            }
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

      const currentDist = camera.position.length();
      const targetDist = state.targetZoom;
      const newDist = currentDist + (targetDist - currentDist) * 0.05;
      camera.position.normalize().multiplyScalar(newDist);
      camera.lookAt(0, 0.5, 0);

      for (const [partId, mesh] of state.hotspots) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const isSelected = selectedIds.has(partId);
        const isHovered = hoveredPart === partId;

        const pulse = Math.sin(time * 3) * 0.02;
        mesh.scale.setScalar(isSelected ? 1.5 + pulse : isHovered ? 1.25 : 1.0);
        mat.opacity = isSelected ? 1.0 : isHovered ? 0.9 : 0.65;

        if (isSelected) {
          mat.color.setHex(0x00f0ff);
        } else {
          const part = AC_PARTS.find((p) => p.id === partId);
          if (part) mat.color.set(CATEGORY_COLORS[part.category]);
        }
      }

      renderer.render(scene, camera);
    }
    animate();

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
      dracoLoader.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addHotspots, onPartToggle]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { hotspots } = sceneRef.current;
    for (const [partId, mesh] of hotspots) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (selectedIds.has(partId)) {
        mat.color.setHex(0x00f0ff);
        mesh.scale.setScalar(1.5);
      } else {
        const part = AC_PARTS.find((p) => p.id === partId);
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
      sceneRef.current.targetZoom = Math.max(2, sceneRef.current.targetZoom - 1);
    }
  }

  function zoomOut() {
    if (sceneRef.current) {
      sceneRef.current.targetZoom = Math.min(15, sceneRef.current.targetZoom + 1);
    }
  }

  function resetView() {
    if (sceneRef.current) {
      sceneRef.current.rotationY = 0;
      sceneRef.current.rotationX = 0;
      sceneRef.current.targetZoom = 6;
      sceneRef.current.autoRotate = true;
      setAutoRotate(true);
    }
  }

  const hoveredPartData = hoveredPart
    ? AC_PARTS.find((p) => p.id === hoveredPart)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-dark-900">
        <div ref={containerRef} className="aspect-[16/10] w-full" />

        {/* Loading overlay */}
        {modelLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/90 backdrop-blur-sm z-10">
            <Loader2 className="h-8 w-8 animate-spin text-neon-cyan mb-3" />
            <p className="text-sm text-text-primary font-medium">
              Carregando modelo 3D...
            </p>
            {loadProgress > 0 && (
              <div className="mt-2 w-48 h-1 rounded-full bg-dark-700 overflow-hidden">
                <div
                  className="h-full bg-neon-cyan transition-all duration-300 rounded-full"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5 z-20">
          <button
            onClick={toggleAutoRotate}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
              autoRotate
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                : "bg-dark-700/80 text-text-secondary border border-border hover:text-text-primary"
            }`}
            title="Rotacao automatica"
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
            title="Resetar visualizacao"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Hovered part tooltip */}
        {hoveredPartData && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg glass px-3 py-2 animate-[fade-in_150ms] z-20">
            <p className="text-sm font-semibold text-text-primary">
              {hoveredPartData.name}
            </p>
            <p className="text-xs text-text-secondary">
              {hoveredPartData.description}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 rounded-lg glass px-3 py-2 z-20">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-text-muted">
            Categorias
          </p>
          <div className="flex flex-col gap-1">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-text-secondary capitalize">
                  {cat}
                </span>
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
          Clique nos pontos no carro 3D ou selecione abaixo os componentes com
          defeito
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
                    style={{
                      backgroundColor: isSelected
                        ? "#00f0ff"
                        : CATEGORY_COLORS[part.category],
                    }}
                  />
                  {isSelected && (
                    <span className="text-[10px] font-bold text-neon-cyan">
                      SELECIONADO
                    </span>
                  )}
                </div>
                <span
                  className={`mt-2 text-sm font-medium ${isSelected ? "text-neon-cyan" : "text-text-primary"}`}
                >
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
