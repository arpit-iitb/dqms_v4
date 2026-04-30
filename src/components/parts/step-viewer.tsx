"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface StepViewerProps {
  fileId?: string;
  src?: string;
  className?: string;
}

export default function StepViewer({ fileId, src, className }: StepViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let animId = 0;

    (async () => {
      try {
        setStatus("loading");

        // 1. Fetch STEP file
        const url = src || (fileId ? `/api/files/${fileId}/serve` : null);
        if (!url) throw new Error("No file source provided");

        const [stepResponse, occtModule] = await Promise.all([
          fetch(url),
          import("occt-import-js").then((m) => m.default({
            locateFile: (name: string) => `/wasm/${name}`,
          })),
        ]);

        if (!stepResponse.ok) throw new Error("Failed to fetch STEP file");
        if (disposed) return;

        const buffer = new Uint8Array(await stepResponse.arrayBuffer());

        // 2. Convert STEP → mesh
        const result = occtModule.ReadStepFile(buffer, null);
        if (!result.meshes || result.meshes.length === 0) {
          throw new Error("No geometry found in STEP file");
        }
        if (disposed) return;

        // 3. Set up Three.js scene
        const width = container.clientWidth;
        const height = Math.max(400, container.clientHeight);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        dirLight2.position.set(-5, -5, -5);
        scene.add(dirLight2);

        // Convert meshes
        const group = new THREE.Group();
        for (const mesh of result.meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.face_position, 3));
          geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.face_normal, 3));
          if (mesh.face_index) {
            geometry.setIndex(Array.from(mesh.face_index));
          }

          const color = mesh.color
            ? new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
            : new THREE.Color(0.7, 0.7, 0.8);

          const material = new THREE.MeshPhongMaterial({
            color,
            side: THREE.DoubleSide,
            flatShading: false,
          });

          group.add(new THREE.Mesh(geometry, material));
        }
        scene.add(group);

        // Auto-fit camera
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();

        camera.position.set(center.x + size * 0.8, center.y + size * 0.5, center.z + size * 0.8);
        camera.lookAt(center);
        camera.near = size * 0.001;
        camera.far = size * 100;
        camera.updateProjectionMatrix();

        // Grid
        const gridSize = size * 2;
        const grid = new THREE.GridHelper(gridSize, 20, 0xcccccc, 0xe0e0e0);
        grid.position.y = box.min.y;
        scene.add(grid);

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.update();

        // Render loop
        const animate = () => {
          if (disposed) return;
          animId = requestAnimationFrame(animate);
          controls?.update();
          renderer?.render(scene, camera);
        };
        animate();

        // Resize handler
        const onResize = () => {
          if (!container || !renderer) return;
          const w = container.clientWidth;
          const h = Math.max(400, container.clientHeight);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        setStatus("ready");

        // Cleanup function stored for disposal
        const cleanup = () => {
          window.removeEventListener("resize", onResize);
          cancelAnimationFrame(animId);
          controls?.dispose();
          renderer?.dispose();
          group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material instanceof THREE.Material) child.material.dispose();
            }
          });
          if (renderer?.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        };
        (container as any).__stepCleanup = cleanup;
      } catch (err: any) {
        if (!disposed) {
          setErrorMsg(err.message || "Failed to load STEP file");
          setStatus("error");
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      const cleanup = (container as any)?.__stepCleanup;
      if (cleanup) cleanup();
    };
  }, [fileId, src]);

  return (
    <div className={className ?? "w-full"} style={{ minHeight: 400 }}>
      {status === "loading" && (
        <div className="flex items-center justify-center h-[400px] bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500" />
            <span className="text-sm">Loading 3D model...</span>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center justify-center h-[400px] bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-600">{errorMsg}</p>
        </div>
      )}
      <div
        ref={containerRef}
        className={`rounded-lg overflow-hidden ${status !== "ready" ? "hidden" : ""}`}
        style={{ minHeight: 400 }}
      />
    </div>
  );
}
