import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TwinState } from "@maitri-bharati/shared";

export type TwinVisualMode = "NORMAL" | "X-RAY" | "SYSTEM" | "HEAT MAP" | "FORECAST" | "REPLAY";

interface Station3DCanvasProps {
  stationId: string;
  twinState: TwinState;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  visualMode: TwinVisualMode;
  isDaytime?: boolean;
  replayStep?: number; // 0 to 100
  windSpeedMs?: number;
}

interface AssetMeshNode {
  assetId: string;
  name: string;
  type: string;
  mesh: THREE.Mesh | THREE.Group;
  originalMaterials: THREE.Material[];
  position: THREE.Vector3;
}

export function Station3DCanvas({
  stationId,
  twinState,
  selectedAssetId,
  onSelectAsset,
  visualMode,
  isDaytime = true,
  replayStep: _replayStep = 100,
  windSpeedMs = 14.5,
}: Station3DCanvasProps): React.JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const assetNodesRef = useRef<AssetMeshNode[]>([]);
  const dependencyLinesRef = useRef<THREE.Line[]>([]);
  const snowParticlesRef = useRef<THREE.Points | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Hover state for tooltip billboard
  const [hoveredNode, setHoveredNode] = useState<{
    name: string;
    type: string;
    status: string;
    health: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Camera target interpolation state
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);

  const isMaitri = stationId === "station-maitri";

  // ── Raycasting & Interaction ──────────────────────────────────────
  const handlePointerMove = useCallback(
    (event: MouseEvent) => {
      const container = mountRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!container || !camera || !scene) return;

      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const interactableMeshes: THREE.Object3D[] = [];
      assetNodesRef.current.forEach((node) => {
        if (node.mesh instanceof THREE.Mesh) {
          interactableMeshes.push(node.mesh);
        } else if (node.mesh instanceof THREE.Group) {
          node.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) interactableMeshes.push(child);
          });
        }
      });

      const intersects = raycaster.intersectObjects(interactableMeshes, true);

      if (intersects.length > 0) {
        container.style.cursor = "pointer";
        let hitObject: THREE.Object3D | null = intersects[0].object;
        let matchedNode: AssetMeshNode | undefined;

        while (hitObject && !matchedNode) {
          matchedNode = assetNodesRef.current.find(
            (node) => node.mesh === hitObject || node.mesh.children.includes(hitObject!)
          );
          hitObject = hitObject.parent;
        }

        if (matchedNode) {
          const liveAsset = twinState.assets.find((a) => a.assetId === matchedNode!.assetId);
          setHoveredNode({
            name: matchedNode.name,
            type: matchedNode.type,
            status: liveAsset?.status ?? "OPERATIONAL",
            health: liveAsset?.healthScore ?? 92,
            screenX: event.clientX - rect.left,
            screenY: event.clientY - rect.top,
          });
          return;
        }
      }

      container.style.cursor = "default";
      setHoveredNode(null);
    },
    [twinState]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const container = mountRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const interactableMeshes: THREE.Object3D[] = [];
      assetNodesRef.current.forEach((node) => {
        if (node.mesh instanceof THREE.Mesh) {
          interactableMeshes.push(node.mesh);
        } else if (node.mesh instanceof THREE.Group) {
          node.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) interactableMeshes.push(child);
          });
        }
      });

      const intersects = raycaster.intersectObjects(interactableMeshes, true);
      if (intersects.length > 0) {
        let hitObject: THREE.Object3D | null = intersects[0].object;
        let matchedNode: AssetMeshNode | undefined;

        while (hitObject && !matchedNode) {
          matchedNode = assetNodesRef.current.find(
            (node) => node.mesh === hitObject || node.mesh.children.includes(hitObject!)
          );
          hitObject = hitObject.parent;
        }

        if (matchedNode) {
          onSelectAsset(matchedNode.assetId);
        }
      }
    },
    [onSelectAsset]
  );

  // ── Camera Fly-To when selected asset changes ──────────────────────
  useEffect(() => {
    if (!selectedAssetId) return;
    const node = assetNodesRef.current.find((n) => n.assetId === selectedAssetId);
    if (node && controlsRef.current) {
      // Smoothly reposition camera to focus on asset hotspot
      const targetPos = node.position.clone();
      targetLookAtRef.current = targetPos.clone();
      targetCameraPosRef.current = new THREE.Vector3(
        targetPos.x + 8,
        targetPos.y + 7,
        targetPos.z + 10
      );
    }
  }, [selectedAssetId]);

  // ── Initialize Scene & WebGL Context ──────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Atmospheric sky background & fog based on day/night
    if (isDaytime) {
      scene.background = new THREE.Color(0xdce7eb); // Polar daytime arctic horizon
      scene.fog = new THREE.FogExp2(0xdce7eb, 0.009);
    } else {
      scene.background = new THREE.Color(0x0a121c); // Deep polar night with aurora hint
      scene.fog = new THREE.FogExp2(0x0a121c, 0.012);
    }

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      1000
    );
    camera.position.set(24, 20, 32);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05; // Prevent camera going below ground
    controls.minDistance = 6;
    controls.maxDistance = 90;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(isDaytime ? 0xffffff : 0x334466, isDaytime ? 0.75 : 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(isDaytime ? 0xfffaed : 0x7799cc, isDaytime ? 1.4 : 0.5);
    dirLight.position.set(30, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    scene.add(dirLight);

    // Warm station perimeter spot/point lights
    const perimeterLight = new THREE.PointLight(0xffa726, 0.8, 40);
    perimeterLight.position.set(0, 8, 0);
    scene.add(perimeterLight);

    // 6. Terrain Creation
    // Maitri: Rocky Schirmacher Oasis moraine (textured brownish-grey gravel with snow patches)
    // Bharati: Coastal Larsemann Hills promontory with blue coastal sea-ice ledge
    const terrainGeo = new THREE.PlaneGeometry(120, 120, 48, 48);
    terrainGeo.rotateX(-Math.PI / 2);

    // Procedural terrain elevation variations
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.sqrt(vx * vx + vz * vz);
      let height = Math.sin(vx * 0.08) * Math.cos(vz * 0.08) * 1.5;
      if (dist < 15) {
        // Flatten building pad
        height *= dist / 15;
      }
      posAttr.setY(i, height);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: isMaitri ? 0xadb5bd : 0xced4da,
      roughness: 0.9,
      metalness: 0.1,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Lake / Sea Ice Moraine accent plane
    const iceEdgeGeo = new THREE.PlaneGeometry(60, 40);
    iceEdgeGeo.rotateX(-Math.PI / 2);
    const iceEdgeMat = new THREE.MeshStandardMaterial({
      color: isMaitri ? 0x90caf9 : 0x4fc3f7, // Lake Priyadarshini for Maitri, sea ice for Bharati
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const iceEdgeMesh = new THREE.Mesh(iceEdgeGeo, iceEdgeMat);
    iceEdgeMesh.position.set(isMaitri ? -35 : 35, 0.05, 0);
    scene.add(iceEdgeMesh);

    // 7. Procedural Station Architecture
    const nodes: AssetMeshNode[] = [];

    if (isMaitri) {
      // ═══════════════════════════════════════════════════════════════
      // MAITRI STATION: Elevated container complex on stilts
      // ═══════════════════════════════════════════════════════════════

      // Concrete / Steel Stilt Pilings
      const stiltMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
      for (let sx = -8; sx <= 8; sx += 4) {
        for (let sz = -5; sz <= 5; sz += 5) {
          const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.5, 8), stiltMat);
          stilt.position.set(sx, 1.25, sz);
          stilt.castShadow = true;
          scene.add(stilt);
        }
      }

      // Main Living & Command Complex (Orange Antarctic Habitat)
      const mainMat = new THREE.MeshStandardMaterial({
        color: 0xe65100, // Antarctic High-Visibility Orange
        roughness: 0.5,
        metalness: 0.2,
      });
      const mainComplex = new THREE.Mesh(new THREE.BoxGeometry(18, 4.5, 12), mainMat);
      mainComplex.position.set(0, 4.5, 0);
      mainComplex.castShadow = true;
      mainComplex.receiveShadow = true;
      scene.add(mainComplex);

      // Observation Bay / Central Mast
      const bayMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.8 });
      const bay = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 2.5, 12), bayMat);
      bay.position.set(0, 7.8, 0);
      scene.add(bay);

      // ASSET: Primary Generator (GEN-01) Container
      const gen1Mat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.5 });
      const gen1Mesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 3.5), gen1Mat);
      gen1Mesh.position.set(-13, 2.6, 6);
      gen1Mesh.castShadow = true;
      scene.add(gen1Mesh);
      // Small exhaust stack
      const exhaust1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2, 8), stiltMat);
      exhaust1.position.set(-13, 4.8, 6);
      scene.add(exhaust1);

      nodes.push({
        assetId: "asset-maitri-gen-1",
        name: "Primary Diesel Generator 125 kVA",
        type: "GENERATOR",
        mesh: gen1Mesh,
        originalMaterials: [gen1Mat],
        position: new THREE.Vector3(-13, 2.6, 6),
      });

      // ASSET: Secondary Generator (GEN-02) Container
      const gen2Mat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4, metalness: 0.5 });
      const gen2Mesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 3.5), gen2Mat);
      gen2Mesh.position.set(-13, 2.6, -1);
      gen2Mesh.castShadow = true;
      scene.add(gen2Mesh);

      nodes.push({
        assetId: "asset-maitri-gen-2",
        name: "Standby Diesel Generator 125 kVA",
        type: "GENERATOR",
        mesh: gen2Mesh,
        originalMaterials: [gen2Mat],
        position: new THREE.Vector3(-13, 2.6, -1),
      });

      // ASSET: Battery Storage Annex (BATT-01)
      const batMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3, metalness: 0.4 });
      const batMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5), batMat);
      batMesh.position.set(-7, 4.0, 7.5);
      batMesh.castShadow = true;
      scene.add(batMesh);

      nodes.push({
        assetId: "asset-maitri-bat-1",
        name: "Central Lithium Battery Bank 150 kWh",
        type: "BATTERY",
        mesh: batMesh,
        originalMaterials: [batMat],
        position: new THREE.Vector3(-7, 4.0, 7.5),
      });

      // ASSET: HVAC & Boiler Plant (HVAC-01)
      const hvacMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.6 });
      const hvacMesh = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 4), hvacMat);
      hvacMesh.position.set(7, 4.2, 7);
      hvacMesh.castShadow = true;
      scene.add(hvacMesh);

      nodes.push({
        assetId: "asset-maitri-hvac-1",
        name: "Primary Central HVAC & Boiler Unit",
        type: "HVAC",
        mesh: hvacMesh,
        originalMaterials: [hvacMat],
        position: new THREE.Vector3(7, 4.2, 7),
      });

      // ASSET: Water Pumphouse near Priyadarshini Lake (WATER-01)
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.3 });
      const waterMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.8, 3.5), waterMat);
      waterMesh.position.set(-22, 1.4, -14);
      waterMesh.castShadow = true;
      scene.add(waterMesh);

      nodes.push({
        assetId: "asset-maitri-water-1",
        name: "Lake Priyadarshini Water Intake Pump",
        type: "WATER",
        mesh: waterMesh,
        originalMaterials: [waterMat],
        position: new THREE.Vector3(-22, 1.4, -14),
      });

      // ASSET: Satellite Comms Radome (COMM-01)
      const commMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.1, metalness: 0.1 });
      const commMesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 16), commMat);
      commMesh.position.set(13, 5.5, -8);
      commMesh.castShadow = true;
      scene.add(commMesh);

      // Radome mast pedestal
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 8), stiltMat);
      mast.position.set(13, 2, -8);
      scene.add(mast);

      nodes.push({
        assetId: "asset-maitri-comm-1",
        name: "Primary Ku-Band Satellite Radome",
        type: "COMMUNICATION",
        mesh: commMesh,
        originalMaterials: [commMat],
        position: new THREE.Vector3(13, 5.5, -8),
      });

      // Solar PV Arrays facing north
      const pvMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.1, metalness: 0.8 });
      for (let pvi = -4; pvi <= 4; pvi += 4) {
        const pv = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.8), pvMat);
        pv.position.set(pvi, 7.0, -4);
        pv.rotation.x = -0.4;
        scene.add(pv);
      }
    } else {
      // ═══════════════════════════════════════════════════════════════
      // BHARATI STATION: Aerodynamic faceted monolith on hydraulic stilts
      // ═══════════════════════════════════════════════════════════════

      // Massive Heavy Hydraulic Stilts
      const stiltMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
      for (let bx = -10; bx <= 10; bx += 5) {
        for (let bz = -6; bz <= 6; bz += 6) {
          const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 3.5, 12), stiltMat);
          stilt.position.set(bx, 1.75, bz);
          stilt.castShadow = true;
          scene.add(stilt);
        }
      }

      // Aerodynamic Main Shell (Silver / Titanium faceted hull)
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.3,
        metalness: 0.6,
      });
      const shell = new THREE.Mesh(new THREE.BoxGeometry(24, 5.5, 14), shellMat);
      shell.position.set(0, 5.5, 0);
      shell.castShadow = true;
      shell.receiveShadow = true;
      scene.add(shell);

      // Panoramic Observation Glass Ribbon
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.1,
        metalness: 0.9,
      });
      const glassRibbon = new THREE.Mesh(new THREE.BoxGeometry(24.2, 1.4, 14.2), glassMat);
      glassRibbon.position.set(0, 6.2, 0);
      scene.add(glassRibbon);

      // ASSET: Combined Heat & Power Tri-Generation Unit (GEN-01)
      const chpMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4, metalness: 0.5 });
      const chpMesh = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.5, 4.5), chpMat);
      chpMesh.position.set(-15, 2.5, 6);
      chpMesh.castShadow = true;
      scene.add(chpMesh);

      nodes.push({
        assetId: "asset-bharati-chp-1",
        name: "Combined Heat & Power Cogeneration Unit",
        type: "GENERATOR",
        mesh: chpMesh,
        originalMaterials: [chpMat],
        position: new THREE.Vector3(-15, 2.5, 6),
      });

      // ASSET: Battery Energy Storage System (BESS-01)
      const bessMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.3, metalness: 0.5 });
      const bessMesh = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), bessMat);
      bessMesh.position.set(-15, 2.5, -3);
      bessMesh.castShadow = true;
      scene.add(bessMesh);

      nodes.push({
        assetId: "asset-bharati-bat-1",
        name: "High-Capacity Li-Ion BESS 250 kWh",
        type: "BATTERY",
        mesh: bessMesh,
        originalMaterials: [bessMat],
        position: new THREE.Vector3(-15, 2.5, -3),
      });

      // ASSET: Reverse Osmosis Desalination & Sea Water Treatment (RO-01)
      const roMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.4 });
      const roMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 4), roMat);
      roMesh.position.set(15, 2.5, 5);
      roMesh.castShadow = true;
      scene.add(roMesh);

      nodes.push({
        assetId: "asset-bharati-water-1",
        name: "Desalination & Reverse Osmosis Plant",
        type: "WATER",
        mesh: roMesh,
        originalMaterials: [roMat],
        position: new THREE.Vector3(15, 2.5, 5),
      });

      // ASSET: High-Latitude Earth Station Satellite Ground Tracking Terminal (GROUND-01)
      const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 });
      const groundMesh = new THREE.Mesh(new THREE.SphereGeometry(2.8, 20, 20), groundMat);
      groundMesh.position.set(16, 6.2, -8);
      groundMesh.castShadow = true;
      scene.add(groundMesh);

      const groundMast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 4.5, 12), stiltMat);
      groundMast.position.set(16, 2.25, -8);
      scene.add(groundMast);

      nodes.push({
        assetId: "asset-bharati-ground-1",
        name: "ISRO/NRSC Earth Station Tracking Radome",
        type: "COMMUNICATION",
        mesh: groundMesh,
        originalMaterials: [groundMat],
        position: new THREE.Vector3(16, 6.2, -8),
      });
    }

    assetNodesRef.current = nodes;

    // 8. 3D System Dependency Flow Lines (for SYSTEM mode)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.8 });
    const depLines: THREE.Line[] = [];

    if (nodes.length >= 3) {
      // Connect Gen -> Battery
      const p1 = nodes[0].position.clone().add(new THREE.Vector3(0, 1.5, 0));
      const p2 = nodes[1].position.clone().add(new THREE.Vector3(0, 1.5, 0));
      const p3 = nodes[2].position.clone().add(new THREE.Vector3(0, 1.5, 0));

      const curve1 = new THREE.CatmullRomCurve3([p1, new THREE.Vector3((p1.x + p2.x) / 2, 5, (p1.z + p2.z) / 2), p2]);
      const lGeo1 = new THREE.BufferGeometry().setFromPoints(curve1.getPoints(24));
      const line1 = new THREE.Line(lGeo1, lineMat);
      line1.visible = false;
      scene.add(line1);
      depLines.push(line1);

      const curve2 = new THREE.CatmullRomCurve3([p2, new THREE.Vector3((p2.x + p3.x) / 2, 6, (p2.z + p3.z) / 2), p3]);
      const lGeo2 = new THREE.BufferGeometry().setFromPoints(curve2.getPoints(24));
      const line2 = new THREE.Line(lGeo2, lineMat);
      line2.visible = false;
      scene.add(line2);
      depLines.push(line2);
    }
    dependencyLinesRef.current = depLines;

    // 9. Snow Drift Particle System (responsive to windSpeed)
    const particleCount = 700;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 80;
      particlePositions[p + 1] = Math.random() * 25;
      particlePositions[p + 2] = (Math.random() - 0.5) * 80;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
    });
    const snowParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(snowParticles);
    snowParticlesRef.current = snowParticles;

    // 10. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      controls.update();

      // Camera Fly-to Lerp
      if (targetCameraPosRef.current && targetLookAtRef.current) {
        camera.position.lerp(targetCameraPosRef.current, 0.05);
        controls.target.lerp(targetLookAtRef.current, 0.05);

        if (camera.position.distanceTo(targetCameraPosRef.current) < 0.2) {
          targetCameraPosRef.current = null;
          targetLookAtRef.current = null;
        }
      }

      // Snow particle drift according to windSpeed
      if (snowParticlesRef.current) {
        const positions = snowParticlesRef.current.geometry.attributes.position.array as Float32Array;
        const speed = Math.max(windSpeedMs, 5) * 0.4;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += delta * speed; // wind blowing along X
          positions[i + 1] -= delta * 3.5; // falling snow

          // Wrap boundaries
          if (positions[i] > 40) positions[i] = -40;
          if (positions[i + 1] < 0) positions[i + 1] = 25;
        }
        snowParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 11. Event Listeners
    const domElem = renderer.domElement;
    domElem.addEventListener("mousemove", handlePointerMove);
    domElem.addEventListener("click", handleClick);

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // 12. Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      domElem.removeEventListener("mousemove", handlePointerMove);
      domElem.removeEventListener("click", handleClick);

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      controls.dispose();
      renderer.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      container.innerHTML = "";
    };
  }, [stationId, isMaitri, isDaytime, handlePointerMove, handleClick]);

  // ── Apply Visual Modes dynamically ────────────────────────────────
  useEffect(() => {
    const nodes = assetNodesRef.current;
    const depLines = dependencyLinesRef.current;

    // Toggle dependency flow lines
    depLines.forEach((line) => {
      line.visible = visualMode === "SYSTEM";
    });

    nodes.forEach((node) => {
      const liveAsset = twinState.assets.find((a) => a.assetId === node.assetId);
      const isSelected = selectedAssetId === node.assetId;
      const status = liveAsset?.status ?? "OPERATIONAL";
      const health = liveAsset?.healthScore ?? 92;

      let mesh = node.mesh;
      if (mesh instanceof THREE.Group) {
        mesh = mesh.children[0] as THREE.Mesh;
      }

      if (!(mesh instanceof THREE.Mesh)) return;

      if (visualMode === "X-RAY") {
        // Translucent glass with wireframe glow
        mesh.material = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x06b6d4 : 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          wireframe: true,
        });
      } else if (visualMode === "SYSTEM") {
        // High-contrast cyber topology
        mesh.material = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x38bdf8 : 0x0ea5e9,
          emissive: isSelected ? 0x0284c7 : 0x0369a1,
          emissiveIntensity: 0.4,
          roughness: 0.3,
          metalness: 0.7,
        });
      } else if (visualMode === "HEAT MAP") {
        // Heatmap: green = cool/nominal, yellow = warn, red = hot/critical
        let heatColor = 0x10b981; // green
        if (status === "FAILED" || health < 60) heatColor = 0xef4444; // red
        else if (status === "DEGRADED" || health < 80) heatColor = 0xf59e0b; // amber

        mesh.material = new THREE.MeshStandardMaterial({
          color: heatColor,
          emissive: heatColor,
          emissiveIntensity: 0.35,
          roughness: 0.4,
        });
      } else if (visualMode === "FORECAST") {
        // Forecast stress pulsing
        const forecastRisk = health < 75 ? 0xf97316 : 0x10b981;
        mesh.material = new THREE.MeshStandardMaterial({
          color: forecastRisk,
          emissive: forecastRisk,
          emissiveIntensity: 0.5,
          roughness: 0.3,
        });
      } else {
        // NORMAL mode
        if (isSelected) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.3,
            roughness: 0.3,
          });
        } else {
          mesh.material = node.originalMaterials[0];
        }
      }
    });
  }, [visualMode, selectedAssetId, twinState]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "480px" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: "480px" }} />

      {/* Floating 3D Hover Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            left: `${hoveredNode.screenX + 14}px`,
            top: `${hoveredNode.screenY - 14}px`,
            background: "rgba(15, 23, 42, 0.92)",
            color: "#ffffff",
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.15)",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600, color: "#38bdf8" }}>{hoveredNode.name}</div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem", fontSize: "0.7rem" }}>
            <span>Type: {hoveredNode.type}</span>
            <span>•</span>
            <span
              style={{
                color:
                  hoveredNode.status === "OPERATIONAL"
                    ? "#4ade80"
                    : hoveredNode.status === "DEGRADED"
                    ? "#facc15"
                    : "#f87171",
              }}
            >
              {hoveredNode.status}
            </span>
            <span>•</span>
            <span>Health: {hoveredNode.health}%</span>
          </div>
        </div>
      )}

      {/* Mode Overlay Badge */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "14px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          background: "rgba(11, 74, 53, 0.85)",
          color: "#ffffff",
          padding: "4px 10px",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.2)",
          zIndex: 5,
        }}
      >
        <span>🧊 {isMaitri ? "Maitri Station (Schirmacher Oasis)" : "Bharati Station (Larsemann Hills)"}</span>
        <span>|</span>
        <span style={{ color: "#a7f3d0" }}>MODE: {visualMode}</span>
      </div>

      {/* Orbit Controls Guidance */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "14px",
          background: "rgba(15, 23, 42, 0.75)",
          color: "#cbd5e1",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "0.7rem",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        🖱️ Rotate: Left Click | Pan: Right Click | Zoom: Scroll
      </div>
    </div>
  );
}
