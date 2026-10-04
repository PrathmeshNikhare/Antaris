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
  onVisualModeChange?: (mode: TwinVisualMode) => void;
  isDaytime?: boolean;
  replayStep?: number;
  windSpeedMs?: number;
  onAskTwin?: (question: string) => void;
  onTriggerTest?: (testKey: string) => void;
}

interface AssetMeshNode {
  assetId: string;
  name: string;
  type: string;
  mesh: THREE.Object3D;
  originalMaterials: THREE.Material[];
  position: THREE.Vector3;
  tagLabel: string;
  category: "POWER" | "THERMAL" | "WATER" | "COMMS" | "STORAGE" | "STRUCTURE" | "RESEARCH";
  health: number;
  status: string;
}

interface ProjectedTag {
  assetId: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
  status: string;
  category: string;
}

export function Station3DCanvas({
  stationId,
  twinState,
  selectedAssetId,
  onSelectAsset,
  visualMode,
  onVisualModeChange,
  isDaytime = true,
  replayStep: _replayStep = 100,
  windSpeedMs = 11.8,
  onAskTwin,
  onTriggerTest,
}: Station3DCanvasProps): React.JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const assetNodesRef = useRef<AssetMeshNode[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const sceneInitializedRef = useRef<boolean>(false);

  // System flow lines & animated particles
  const systemFlowCurvesRef = useRef<THREE.CatmullRomCurve3[]>([]);
  const flowTubesGroupRef = useRef<THREE.Group | null>(null);
  const internalMachineryGroupRef = useRef<THREE.Group | null>(null);
  const outerShellsGroupRef = useRef<THREE.Group | null>(null);
  const snowParticlesRef = useRef<THREE.Points | null>(null);

  // UI state toggles matching screenshots
  const [sensorsEnabled, setSensorsEnabled] = useState<boolean>(true);
  const [labelsEnabled, setLabelsEnabled] = useState<boolean>(true);
  const [projectedTags, setProjectedTags] = useState<ProjectedTag[]>([]);
  const [consoleOpen, setConsoleOpen] = useState<boolean>(false);
  const [consoleTab, setConsoleTab] = useState<"RUNNING" | "CONTROL">("RUNNING");
  const [cliInput, setCliInput] = useState<string>("");

  // Derive station metrics from twinState
  const avgHealth =
    twinState?.assets && twinState.assets.length > 0
      ? Math.round(
          twinState.assets.reduce((sum, a) => sum + (a.healthScore ?? 100), 0) /
            twinState.assets.length
        )
      : 89;
  const stationStatus = twinState?.stationStatus || "OPERATIONAL";

  const windSpeedRef = useRef<number>(windSpeedMs);
  windSpeedRef.current = windSpeedMs;

  const onSelectAssetRef = useRef(onSelectAsset);
  onSelectAssetRef.current = onSelectAsset;

  // Synchronize dynamic health and status from twinState to assetNodes
  useEffect(() => {
    if (!twinState?.assets) return;
    twinState.assets.forEach((liveAsset) => {
      const match = assetNodesRef.current.find(
        (n) => n.assetId === liveAsset.assetId || n.name.toLowerCase() === liveAsset.name.toLowerCase()
      );
      if (match) {
        match.health = liveAsset.healthScore;
        match.status = liveAsset.status;
      }
    });
  }, [twinState]);

  // Camera interpolation target
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);

  const isMaitri = stationId === "station-maitri";

  // Reset view to default isometric perspective
  const handleResetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    targetCameraPosRef.current = new THREE.Vector3(26, 22, 34);
    targetLookAtRef.current = new THREE.Vector3(0, 3, 0);
  }, []);

  // Raycasting click selection
  const handlePointerDown = useCallback((event: MouseEvent) => {
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
      node.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) interactableMeshes.push(child);
      });
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
        onSelectAssetRef.current(matchedNode.assetId);
        setConsoleOpen(true);
      }
    }
  }, []);

  // Smooth camera fly-to when selected asset changes
  useEffect(() => {
    if (!selectedAssetId) return;
    const node = assetNodesRef.current.find((n) => n.assetId === selectedAssetId);
    if (node) {
      const targetPos = node.position.clone();
      targetLookAtRef.current = targetPos.clone();
      targetCameraPosRef.current = new THREE.Vector3(
        targetPos.x + 9,
        targetPos.y + 8,
        targetPos.z + 12
      );
      setConsoleOpen(true);
    }
  }, [selectedAssetId]);

  // ─── Initialize Three.js Scene ─────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Idempotent guard: React 18/19 StrictMode double-invokes effects.
    // If already initialized and the renderer is still attached, skip.
    if (sceneInitializedRef.current && rendererRef.current) {
      return;
    }

    // Clean up any prior renderer before creating a new one
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const skyColor = isDaytime ? 0xe5ebee : 0x09101a;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.FogExp2(skyColor, isDaytime ? 0.007 : 0.012);

    // 2. Camera setup — ensure positive dimensions
    const containerW = Math.max(container.clientWidth, 300);
    const containerH = Math.max(container.clientHeight, 300);
    const camera = new THREE.PerspectiveCamera(
      42,
      containerW / containerH,
      0.1,
      1000
    );
    camera.position.set(26, 22, 34);
    cameraRef.current = camera;

    // 3. WebGL Renderer with soft shadows
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (e) {
      console.error("[Station3DCanvas] Failed to create WebGL renderer:", e);
      return;
    }
    renderer.setSize(containerW, containerH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDaytime ? 1.05 : 0.85;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    sceneInitializedRef.current = true;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.minDistance = 6;
    controls.maxDistance = 110;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(isDaytime ? 0xffffff : 0x334466, isDaytime ? 0.8 : 0.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(isDaytime ? 0xfffaed : 0x7799cc, isDaytime ? 1.5 : 0.6);
    dirLight.position.set(35, 55, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.0003;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(isDaytime ? 0xcce0ff : 0x1a2638, isDaytime ? 0.4 : 0.2);
    fillLight.position.set(-30, 20, -30);
    scene.add(fillLight);

    // 6. Polar Moraine Ground Terrain with Subtle Coordinates Grid
    const terrainGeo = new THREE.PlaneGeometry(160, 160, 64, 64);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.sqrt(vx * vx + vz * vz);
      let height = Math.sin(vx * 0.06) * Math.cos(vz * 0.06) * 1.6;
      if (dist < 18) {
        height *= dist / 18; // Flat building pad
      }
      posAttr.setY(i, height);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x1f2429, // Dark polar moraine rock/asphalt matching reference
      roughness: 0.92,
      metalness: 0.08,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Ground Grid Helper for high-tech spatial coordinate reference
    const gridHelper = new THREE.GridHelper(140, 70, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // Polar Moraine Boulders / Rocks scattered
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const rockPositions = [
      [-18, 0.4, 18], [-22, 0.6, -8], [24, 0.5, 14], [20, 0.7, -18],
      [-12, 0.3, 24], [16, 0.4, 22], [-28, 0.8, 5], [26, 0.6, -6],
      [-6, 0.3, -22], [8, 0.4, -24], [-30, 0.9, -15], [32, 0.7, 10],
    ];
    rockPositions.forEach(([rx, ry, rz], idx) => {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const scale = 0.6 + ((idx * 37) % 10) * 0.12;
      rock.scale.set(scale * 1.2, scale * 0.8, scale * 1.1);
      rock.position.set(rx, ry * scale, rz);
      rock.rotation.set(idx, idx * 0.5, idx * 0.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    });

    // Red & Orange Arctic Perimeter Marker Flags
    const flagPositions = [
      [-22, 12], [-14, 20], [0, 22], [14, 20], [22, 12],
      [22, -12], [14, -20], [0, -22], [-14, -20], [-22, -12],
    ];
    flagPositions.forEach(([fx, fz], idx) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
      );
      pole.position.set(fx, 0.9, fz);
      scene.add(pole);

      const pennantGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0.8, 0,
        0.5, 0.65, 0,
        0, 0.5, 0,
      ]);
      pennantGeo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      const pennant = new THREE.Mesh(
        pennantGeo,
        new THREE.MeshBasicMaterial({ color: idx % 2 === 0 ? 0xef4444 : 0xf97316, side: THREE.DoubleSide })
      );
      pennant.position.set(fx, 0.9, fz);
      scene.add(pennant);
    });

    // 7. Helipad Facility in Front of Station
    const helipadGroup = new THREE.Group();
    helipadGroup.position.set(2, 0.05, 14);

    // Dark circular asphalt pad
    const padMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 6.5, 0.15, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    );
    padMesh.receiveShadow = true;
    helipadGroup.add(padMesh);

    // Thick yellow ring border
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(5.8, 6.3, 36),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
    );
    ringMesh.rotateX(-Math.PI / 2);
    ringMesh.position.y = 0.09;
    helipadGroup.add(ringMesh);

    // Bold Yellow 'H' Helipad Marking
    const hBarMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const hBarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 3.2), hBarMat);
    hBarLeft.position.set(-1.1, 0.1, 0);
    const hBarRight = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 3.2), hBarMat);
    hBarRight.position.set(1.1, 0.1, 0);
    const hBarCenter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.65), hBarMat);
    hBarCenter.position.set(0, 0.1, 0);
    helipadGroup.add(hBarLeft, hBarRight, hBarCenter);

    // Perimeter landing lights (green / amber dots around the rim)
    for (let li = 0; li < 12; li++) {
      const angle = (li / 12) * Math.PI * 2;
      const lightMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.8 })
      );
      lightMesh.position.set(Math.cos(angle) * 6.3, 0.15, Math.sin(angle) * 6.3);
      helipadGroup.add(lightMesh);
    }
    scene.add(helipadGroup);

    // Concrete walkway connecting helipad to entrance stairs
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
    );
    walkway.position.set(2, 0.05, 8.5);
    walkway.receiveShadow = true;
    scene.add(walkway);

    // 8. Ground Level Cargo ISO Shipping Containers & Auxiliary Equipment
    const containerMatGrey = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6, metalness: 0.4 });
    const containerMatBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5, metalness: 0.3 });
    const containerMatWhite = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 });

    const containerDefs = [
      { pos: [-6, 1.3, 11], rot: 0, mat: containerMatWhite, size: [5.8, 2.5, 2.4] },
      { pos: [-12, 1.3, 9], rot: 0.2, mat: containerMatGrey, size: [5.8, 2.5, 2.4] },
      { pos: [11, 1.3, 11], rot: -0.1, mat: containerMatGrey, size: [5.8, 2.5, 2.4] },
      { pos: [14, 1.3, 13], rot: -0.1, mat: containerMatBlue, size: [5.8, 2.5, 2.4] },
    ];
    containerDefs.forEach((c) => {
      const cMesh = new THREE.Mesh(new THREE.BoxGeometry(c.size[0], c.size[1], c.size[2]), c.mat);
      cMesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
      cMesh.rotation.y = c.rot;
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      scene.add(cMesh);
    });

    // Bulk Cylindrical Fuel Tanks with Yellow Hazard Cradles
    const fuelTankMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.4, metalness: 0.6 });
    const cradleMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
    for (let fti = 0; fti < 2; fti++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.5, 18), fuelTankMat);
      tank.rotation.z = Math.PI / 2;
      tank.position.set(-18, 1.6, -2 + fti * 3.5);
      tank.castShadow = true;
      scene.add(tank);

      // Tank cradle legs
      const cradle1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 2.8), cradleMat);
      cradle1.position.set(-19.5, 0.7, -2 + fti * 3.5);
      const cradle2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 2.8), cradleMat);
      cradle2.position.set(-16.5, 0.7, -2 + fti * 3.5);
      scene.add(cradle1, cradle2);
    }

    // High Voltage Transformer Unit on Ground
    const transformerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
    );
    transformerMesh.position.set(-14, 1.3, 3);
    transformerMesh.castShadow = true;
    scene.add(transformerMesh);

    // Transformer Radiator Cooling Fins
    for (let ri = -0.8; ri <= 0.8; ri += 0.3) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.0, 2.4), cradleMat);
      fin.position.set(-12.7, 1.3, 3 + ri);
      scene.add(fin);
    }

    // ─── 9. Build Modular Station Buildings on Space-Frame Stilts ───────
    const outerShellsGroup = new THREE.Group();
    outerShellsGroupRef.current = outerShellsGroup;
    scene.add(outerShellsGroup);

    const internalMachineryGroup = new THREE.Group();
    internalMachineryGroupRef.current = internalMachineryGroup;
    scene.add(internalMachineryGroup);

    const nodes: AssetMeshNode[] = [];

    // Helper: Build Steel Space-Frame Cross-Braced Stilts (Trusses) under a module
    const stiltSteelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 });
    const createStilts = (x: number, z: number, w: number, d: number, height = 2.8) => {
      const group = new THREE.Group();
      const colRadius = 0.16;
      const hw = w / 2 - 0.4;
      const hd = d / 2 - 0.4;
      const corners = [
        [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
        [0, -hd], [0, hd], [-hw, 0], [hw, 0],
      ];

      // Vertical Legs
      corners.forEach(([cx, cz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(colRadius, colRadius, height, 8), stiltSteelMat);
        leg.position.set(cx, height / 2, cz);
        leg.castShadow = true;
        group.add(leg);
      });

      // Diagonal X-Braces
      const xBraceGeo = new THREE.CylinderGeometry(0.06, 0.06, Math.sqrt(height * height + (w / 2) * (w / 2)), 6);
      const braceAngle = Math.atan2(height, w / 2);

      const b1 = new THREE.Mesh(xBraceGeo, stiltSteelMat);
      b1.position.set(0, height / 2, -hd);
      b1.rotation.z = braceAngle;
      const b2 = new THREE.Mesh(xBraceGeo, stiltSteelMat);
      b2.position.set(0, height / 2, -hd);
      b2.rotation.z = -braceAngle;
      group.add(b1, b2);

      group.position.set(x, 0, z);
      scene.add(group);
    };

    // Shared Building Materials
    const panelWallMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Clean Antarctic off-white insulated panels
      roughness: 0.35,
      metalness: 0.15,
    });
    const panelTrimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Dark slate window frames and roof rims
      roughness: 0.2,
      metalness: 0.8,
    });
    const orangeAccentMat = new THREE.MeshStandardMaterial({
      color: 0xe65100, // Antarctic hi-vis safety orange
      roughness: 0.4,
      metalness: 0.2,
    });
    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0f293d,
      roughness: 0.1,
      metalness: 0.9,
    });

    // ── MODULE 1: MAIN BUILDING (Center) ──────────────────────────────
    const mbW = 14, mbH = 6.2, mbD = 9.5;
    const mbY = 2.8 + mbH / 2; // Elevated on 2.8m stilts
    createStilts(0, 0, mbW, mbD, 2.8);

    const mainBuildingMesh = new THREE.Mesh(new THREE.BoxGeometry(mbW, mbH, mbD), panelWallMat);
    mainBuildingMesh.position.set(0, mbY, 0);
    mainBuildingMesh.castShadow = true;
    mainBuildingMesh.receiveShadow = true;
    outerShellsGroup.add(mainBuildingMesh);

    // Black Horizontal Window Strips (Recessed bands on two levels)
    const winStrip1 = new THREE.Mesh(new THREE.BoxGeometry(mbW + 0.05, 0.8, mbD + 0.05), windowGlassMat);
    winStrip1.position.set(0, mbY + 1.2, 0);
    outerShellsGroup.add(winStrip1);
    const winStrip2 = new THREE.Mesh(new THREE.BoxGeometry(mbW + 0.05, 0.8, mbD + 0.05), windowGlassMat);
    winStrip2.position.set(0, mbY - 1.2, 0);
    outerShellsGroup.add(winStrip2);

    // Front Entrance Airlock Cube with illuminated frame
    const airlock = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 3.2, 2.2),
      panelWallMat
    );
    airlock.position.set(0, 2.8 + 1.6, mbD / 2 + 1.0);
    airlock.castShadow = true;
    outerShellsGroup.add(airlock);

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.5 })
    );
    doorFrame.position.set(0, 2.8 + 1.3, mbD / 2 + 2.15);
    outerShellsGroup.add(doorFrame);

    // Metal Entrance Stairs descending to ground level with railings
    const stairSteps = 7;
    for (let si = 0; si < stairSteps; si++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.25, 0.5),
        stiltSteelMat
      );
      step.position.set(0, (stairSteps - si) * 0.38, mbD / 2 + 2.2 + si * 0.45);
      step.castShadow = true;
      scene.add(step);
    }
    // Stair handrails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7 });
    const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.0), railMat);
    railL.position.set(-1.0, 1.8, mbD / 2 + 3.6);
    railL.rotation.x = 0.7;
    const railR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.0), railMat);
    railR.position.set(1.0, 1.8, mbD / 2 + 3.6);
    railR.rotation.x = 0.7;
    scene.add(railL, railR);

    // Flagpole with Indian Flag (Tiranga 🇮🇳)
    const poleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.1 })
    );
    poleMesh.position.set(-3.2, 4.5, mbD / 2 + 2.5);
    poleMesh.castShadow = true;
    scene.add(poleMesh);

    // Indian Flag Mesh (Saffron, White with Ashoka Chakra hint, Green)
    const flagMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.3 })
    );
    flagMesh.position.set(-2.0, 7.8, mbD / 2 + 2.5);
    scene.add(flagMesh);

    // Rooftop HVAC Units on Main Building (Dual fan grilles)
    for (let hi = -2.5; hi <= 2.5; hi += 5.0) {
      const hvacUnit = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.4, 2.2),
        panelTrimMat
      );
      hvacUnit.position.set(hi, mbY + mbH / 2 + 0.7, 0);
      hvacUnit.castShadow = true;
      outerShellsGroup.add(hvacUnit);

      // Twin fan grilles on top
      const fan1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), stiltSteelMat);
      fan1.position.set(hi - 0.5, mbY + mbH / 2 + 1.45, 0);
      const fan2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), stiltSteelMat);
      fan2.position.set(hi + 0.5, mbY + mbH / 2 + 1.45, 0);
      outerShellsGroup.add(fan1, fan2);
    }

    // Rooftop Solar PV Panel Racks on Main Building (Angled facing north)
    const pvPanelMat = new THREE.MeshStandardMaterial({
      color: 0x172554, // Deep glossy navy solar panel
      roughness: 0.1,
      metalness: 0.9,
    });
    for (let pi = -4; pi <= 4; pi += 3.8) {
      const pv = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 2.0), pvPanelMat);
      pv.position.set(pi, mbY + mbH / 2 + 0.6, -2.5);
      pv.rotation.x = -0.35; // Tilted towards polar sun
      pv.castShadow = true;
      outerShellsGroup.add(pv);
    }

    nodes.push({
      assetId: isMaitri ? "asset-maitri-bld-main" : "asset-bharati-bld-main",
      name: "Main Habitat & Command Center",
      type: "STRUCTURE",
      mesh: mainBuildingMesh,
      originalMaterials: [panelWallMat],
      position: new THREE.Vector3(0, mbY + 1.5, 0),
      tagLabel: "• MAIN BUILDING",
      category: "STRUCTURE",
      health: 96,
      status: "OPERATIONAL",
    });

    // ── MODULE 2: ENERGY & BATTERY MODULE (Left-Rear) ───────────────────
    const enW = 8.5, enH = 5.2, enD = 7.5;
    const enX = -12.5, enZ = -3.5;
    const enY = 2.8 + enH / 2;
    createStilts(enX, enZ, enW, enD, 2.8);

    const energyModuleMesh = new THREE.Mesh(new THREE.BoxGeometry(enW, enH, enD), panelWallMat);
    energyModuleMesh.position.set(enX, enY, enZ);
    energyModuleMesh.castShadow = true;
    energyModuleMesh.receiveShadow = true;
    outerShellsGroup.add(energyModuleMesh);

    // Energy Module Roof Solar Array
    for (let epi = -2.2; epi <= 2.2; epi += 2.2) {
      const epv = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 2.4), pvPanelMat);
      epv.position.set(enX + epi, enY + enH / 2 + 0.6, enZ - 0.5);
      epv.rotation.x = -0.35;
      outerShellsGroup.add(epv);
    }

    // Exhaust vent stacks on Energy roof
    for (let vi = -1; vi <= 1; vi += 2) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8), stiltSteelMat);
      stack.position.set(enX + vi * 1.5, enY + enH / 2 + 1.1, enZ + 1.5);
      outerShellsGroup.add(stack);
    }

    // Corridor connecting Energy to Main Building
    const bridge1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 2.4), panelWallMat);
    bridge1.position.set((enX + 0) / 2 - 1.5, 4.5, (enZ + 0) / 2);
    bridge1.castShadow = true;
    outerShellsGroup.add(bridge1);

    nodes.push({
      assetId: isMaitri ? "asset-maitri-bat-1" : "asset-bharati-bat-1",
      name: "Central Microgrid Battery Bank A/B (150 kWh)",
      type: "BATTERY",
      mesh: energyModuleMesh,
      originalMaterials: [panelWallMat],
      position: new THREE.Vector3(enX, enY + 1.0, enZ),
      tagLabel: "• ENERGY",
      category: "POWER",
      health: 89,
      status: "OPERATIONAL",
    });

    // ── MODULE 3: DIESEL GENERATOR POWERHOUSE (Left-Front) ─────────────
    const genW = 7.0, genH = 4.8, genD = 6.5;
    const genX = -13.5, genZ = 6.5;
    const genY = 2.8 + genH / 2;
    createStilts(genX, genZ, genW, genD, 2.8);

    const genModuleMesh = new THREE.Mesh(new THREE.BoxGeometry(genW, genH, genD), panelWallMat);
    genModuleMesh.position.set(genX, genY, genZ);
    genModuleMesh.castShadow = true;
    outerShellsGroup.add(genModuleMesh);

    // High heavy-duty muffler exhaust pipe
    const genExhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.5, 12), stiltSteelMat);
    genExhaust.position.set(genX + 1.5, genY + genH / 2 + 1.75, genZ - 1.0);
    outerShellsGroup.add(genExhaust);

    // Fuel Day Tank on cradle outside generator module
    const dayTank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.8, 12), fuelTankMat);
    dayTank.rotation.z = Math.PI / 2;
    dayTank.position.set(genX - 4.5, 3.2, genZ);
    outerShellsGroup.add(dayTank);

    nodes.push({
      assetId: isMaitri ? "asset-maitri-gen-1" : "asset-bharati-chp-1",
      name: "Primary Diesel Generator 125 kVA (GEN #1)",
      type: "GENERATOR",
      mesh: genModuleMesh,
      originalMaterials: [panelWallMat],
      position: new THREE.Vector3(genX, genY + 1.0, genZ),
      tagLabel: "• GENERATOR",
      category: "POWER",
      health: 88,
      status: "OPERATIONAL",
    });

    // ── MODULE 4: STORAGE & LOGISTICS MODULE (Right-Rear) ───────────────
    const stW = 8.5, stH = 5.2, stD = 7.5;
    const stX = 12.5, stZ = -5.0;
    const stY = 2.8 + stH / 2;
    createStilts(stX, stZ, stW, stD, 2.8);

    const storageModuleMesh = new THREE.Mesh(new THREE.BoxGeometry(stW, stH, stD), panelWallMat);
    storageModuleMesh.position.set(stX, stY, stZ);
    storageModuleMesh.castShadow = true;
    outerShellsGroup.add(storageModuleMesh);

    // Orange hi-vis side accent banner
    const orangeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, stH - 0.4, stD - 0.4), orangeAccentMat);
    orangeStripe.position.set(stX + stW / 2 + 0.05, stY, stZ);
    outerShellsGroup.add(orangeStripe);

    // Corridor connecting Storage to Main Building
    const bridge2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 2.4), panelWallMat);
    bridge2.position.set((stX + 0) / 2 + 1.5, 4.5, (stZ + 0) / 2);
    bridge2.castShadow = true;
    outerShellsGroup.add(bridge2);

    nodes.push({
      assetId: isMaitri ? "asset-maitri-hvac-1" : "asset-bharati-hvac-1",
      name: "Primary HVAC & Cold Storage Facility",
      type: "HVAC",
      mesh: storageModuleMesh,
      originalMaterials: [panelWallMat],
      position: new THREE.Vector3(stX, stY + 1.0, stZ),
      tagLabel: "• STORAGE",
      category: "STORAGE",
      health: 94,
      status: "OPERATIONAL",
    });

    // ── MODULE 5: RESEARCH & SCIENCE LABORATORY (Right-Front) ───────────
    const resW = 8.0, resH = 5.0, resD = 7.0;
    const resX = 13.0, resZ = 5.5;
    const resY = 2.8 + resH / 2;
    createStilts(resX, resZ, resW, resD, 2.8);

    const researchModuleMesh = new THREE.Mesh(new THREE.BoxGeometry(resW, resH, resD), panelWallMat);
    researchModuleMesh.position.set(resX, resY, resZ);
    researchModuleMesh.castShadow = true;
    outerShellsGroup.add(researchModuleMesh);

    // Dual Geodesic Radome Tracking Spheres on Research Roof (Screenshots 1, 2!)
    const radomeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.1,
    });
    const radome1 = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 24), radomeMat);
    radome1.position.set(resX - 1.8, resY + resH / 2 + 1.5, resZ);
    radome1.castShadow = true;
    outerShellsGroup.add(radome1);

    const radome2 = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 24), radomeMat);
    radome2.position.set(resX + 1.8, resY + resH / 2 + 1.2, resZ - 1.2);
    radome2.castShadow = true;
    outerShellsGroup.add(radome2);

    // Parabolic Satellite Tracking Dish
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.7 });
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.5), dishMat);
    dish.position.set(resX, resY + resH / 2 + 1.8, resZ + 1.5);
    dish.rotation.x = -1.1;
    outerShellsGroup.add(dish);

    // Tall Meteorological / Radio Lattice Tower with blinking red beacon
    const towerMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.45, 12, 6),
      stiltSteelMat
    );
    towerMast.position.set(resX + 3.0, resY + 5.0, resZ + 2.0);
    outerShellsGroup.add(towerMast);

    const redBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redBeacon.position.set(resX + 3.0, resY + 11.1, resZ + 2.0);
    outerShellsGroup.add(redBeacon);

    nodes.push({
      assetId: isMaitri ? "asset-maitri-water-1" : "asset-bharati-ro-1",
      name: "Atmospheric & Cryospheric Research Lab",
      type: "RESEARCH",
      mesh: researchModuleMesh,
      originalMaterials: [panelWallMat],
      position: new THREE.Vector3(resX, resY + 1.0, resZ),
      tagLabel: "• RESEARCH",
      category: "RESEARCH",
      health: 98,
      status: "OPERATIONAL",
    });

    // ── MODULE 6: COMMUNICATIONS HUB (Center-Rear) ─────────────────────
    const comW = 5.5, comH = 4.5, comD = 5.0;
    const comX = 0, comZ = -9.5;
    const comY = 2.8 + comH / 2;
    createStilts(comX, comZ, comW, comD, 2.8);

    const commsModuleMesh = new THREE.Mesh(new THREE.BoxGeometry(comW, comH, comD), panelWallMat);
    commsModuleMesh.position.set(comX, comY, comZ);
    commsModuleMesh.castShadow = true;
    outerShellsGroup.add(commsModuleMesh);

    // Comms Mast and dishes
    const commMast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 9, 6), stiltSteelMat);
    commMast.position.set(comX, comY + 4.5, comZ);
    outerShellsGroup.add(commMast);

    const commDish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), dishMat);
    commDish.position.set(comX, comY + 4.0, comZ);
    commDish.rotation.x = -0.9;
    outerShellsGroup.add(commDish);

    nodes.push({
      assetId: isMaitri ? "asset-maitri-comm-1" : "asset-bharati-ground-1",
      name: "Ku-Band Satellite Earth Station & Radome",
      type: "COMMS",
      mesh: commsModuleMesh,
      originalMaterials: [panelWallMat],
      position: new THREE.Vector3(comX, comY + 1.0, comZ),
      tagLabel: "• COMMS",
      category: "COMMS",
      health: 99,
      status: "OPERATIONAL",
    });

    // ─── 10. INTERNAL MACHINERY FOR X-RAY MODE (Screenshot 4!) ─────────
    // A) Diesel Generator Engine Blocks inside Generator Module
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });

    for (let gi = 0; gi < 2; gi++) {
      const engineGroup = new THREE.Group();
      engineGroup.position.set(genX - 1.5 + gi * 3.2, 3.2, genZ);

      // Engine block base
      const block = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.2), engineMat);
      // Alternator cylindrical head
      const alt = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.2, 12), chromeMat);
      alt.rotation.z = Math.PI / 2;
      alt.position.set(1.4, 0, 0);
      // Intake manifold tubes
      const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), chromeMat);
      manifold.rotation.z = Math.PI / 2;
      manifold.position.set(0, 0.9, 0);

      engineGroup.add(block, alt, manifold);
      internalMachineryGroup.add(engineGroup);
    }

    // B) Battery Racks with Glowing Green/Cyan LEDs inside Energy Module
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    for (let bi = -2.5; bi <= 2.5; bi += 1.8) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.6, 1.0), rackMat);
      rack.position.set(enX + bi, 3.2 + 1.8, enZ);
      internalMachineryGroup.add(rack);

      // Glowing LED charge level strips
      for (let li = 0; li < 4; li++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.04), ledMat);
        led.position.set(enX + bi, 3.2 + 0.8 + li * 0.7, enZ + 0.52);
        internalMachineryGroup.add(led);
      }
    }

    // C) Command Workstation Desks inside Main Building
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.8, 1.4), deskMat);
    desk.position.set(0, 3.2 + 0.8, 0);
    internalMachineryGroup.add(desk);

    for (let mi = -1.6; mi <= 1.6; mi += 1.6) {
      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.65, 0.04), screenMat);
      screen.position.set(mi, 3.2 + 1.5, 0.4);
      internalMachineryGroup.add(screen);
    }

    // ─── 11. SYSTEM MODE: 3D GLOWING FLOW TUBES (Screenshot 5!) ────────
    const flowTubesGroup = new THREE.Group();
    flowTubesGroupRef.current = flowTubesGroup;
    scene.add(flowTubesGroup);

    // Create Spline Curves connecting energy nodes
    const curve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, mbY + mbH / 2 + 0.8, -2.5), // Roof Solar
      new THREE.Vector3(-6, 7.5, -2.0),
      new THREE.Vector3(enX, 6.2, enZ), // Inverter / Battery
      new THREE.Vector3(-6, 4.8, 0),
      new THREE.Vector3(0, 4.8, 0), // Main Bus
    ]);

    const curve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(genX, 5.0, genZ), // Diesel Gens
      new THREE.Vector3(-8, 4.8, 3.0),
      new THREE.Vector3(0, 4.8, 0), // Main Bus
    ]);

    const curve3 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.8, 0), // Main Bus
      new THREE.Vector3(6, 4.8, 2.5),
      new THREE.Vector3(resX, 5.5, resZ), // Research Lab & Cryo
    ]);

    const curve4 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.8, 0), // Main Bus
      new THREE.Vector3(6, 4.8, -2.5),
      new THREE.Vector3(stX, 5.2, stZ), // HVAC & Life Support
    ]);

    systemFlowCurvesRef.current = [curve1, curve2, curve3, curve4];

    // Tube Meshes with emissive neon materials
    const solarTubeGeo = new THREE.TubeGeometry(curve1, 48, 0.14, 8, false);
    const solarTubeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Glowing Orange
    const genTubeGeo = new THREE.TubeGeometry(curve2, 36, 0.14, 8, false);
    const genTubeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 }); // Glowing Cyan
    const loadTubeGeo1 = new THREE.TubeGeometry(curve3, 36, 0.14, 8, false);
    const loadTubeMat = new THREE.MeshBasicMaterial({ color: 0x22c55e }); // Glowing Green
    const loadTubeGeo2 = new THREE.TubeGeometry(curve4, 36, 0.14, 8, false);

    const m1 = new THREE.Mesh(solarTubeGeo, solarTubeMat);
    const m2 = new THREE.Mesh(genTubeGeo, genTubeMat);
    const m3 = new THREE.Mesh(loadTubeGeo1, loadTubeMat);
    const m4 = new THREE.Mesh(loadTubeGeo2, loadTubeMat);
    flowTubesGroup.add(m1, m2, m3, m4);

    // Glowing Node Spheres at junctions
    const junctionGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const j1 = new THREE.Mesh(junctionGeo, new THREE.MeshBasicMaterial({ color: 0xf97316 }));
    j1.position.copy(curve1.getPoint(0.5));
    const j2 = new THREE.Mesh(junctionGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    j2.position.set(0, 4.8, 0);
    flowTubesGroup.add(j1, j2);

    flowTubesGroup.visible = visualMode === "SYSTEM";

    // ─── 12. Snow Drift Particle System ────────────────────────────────
    const snowCount = 450;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    for (let si = 0; si < snowCount; si++) {
      snowPositions[si * 3] = (Math.random() - 0.5) * 80;
      snowPositions[si * 3 + 1] = Math.random() * 22;
      snowPositions[si * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.8,
    });
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    snowParticlesRef.current = snowPoints;
    scene.add(snowPoints);

    assetNodesRef.current = nodes;

    // Pointer event listeners
    renderer.domElement.addEventListener("click", handlePointerDown);

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // ─── Animation Render Loop ─────────────────────────────────────────
    let lastTagUpdate = 0;

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const now = performance.now();

      // Camera position interpolation for smooth fly-to lerp
      if (targetCameraPosRef.current && targetLookAtRef.current) {
        camera.position.lerp(targetCameraPosRef.current, 0.06);
        controls.target.lerp(targetLookAtRef.current, 0.06);
        if (camera.position.distanceTo(targetCameraPosRef.current) < 0.1) {
          targetCameraPosRef.current = null;
          targetLookAtRef.current = null;
        }
      }

      controls.update();

      // Animate Snow Drift particles based on live windSpeedRef
      if (snowParticlesRef.current) {
        const pos = snowParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const driftSpeed = Math.max(windSpeedRef.current * 0.12, 1.2);
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - driftSpeed * 0.04;
          let x = pos.getX(i) + driftSpeed * 0.08;
          let z = pos.getZ(i) + driftSpeed * 0.04;

          if (y < 0.1) y = 22;
          if (x > 40) x = -40;
          if (z > 40) z = -40;

          pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
      }

      // Throttle 3D Asset screen projection updates to ~16 fps for optimal UI reactivity
      if (now - lastTagUpdate > 60 && container && camera) {
        lastTagUpdate = now;
        const widthHalf = container.clientWidth / 2;
        const heightHalf = container.clientHeight / 2;
        const tags: ProjectedTag[] = [];

        assetNodesRef.current.forEach((node) => {
          const worldPos = node.position.clone();
          worldPos.y += 2.8; // Float slightly above module
          worldPos.project(camera);

          // Only show if in front of camera
          if (worldPos.z < 1) {
            const sx = worldPos.x * widthHalf + widthHalf;
            const sy = -(worldPos.y * heightHalf) + heightHalf;
            tags.push({
              assetId: node.assetId,
              label: node.tagLabel,
              x: sx,
              y: sy,
              visible: sx >= 20 && sx <= container.clientWidth - 20 && sy >= 20 && sy <= container.clientHeight - 20,
              status: node.status,
              category: node.category,
            });
          }
        });
        setProjectedTags(tags);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      sceneInitializedRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handlePointerDown);
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      if (container) container.innerHTML = "";
    };
  }, [isMaitri, isDaytime, handlePointerDown]);

  // ─── Mode Effect Updates (X-RAY, SYSTEM, HEAT MAP, NORMAL) ─────────
  useEffect(() => {
    if (!outerShellsGroupRef.current || !internalMachineryGroupRef.current || !flowTubesGroupRef.current) return;

    if (visualMode === "X-RAY") {
      // Make building outer shells semi-transparent glass
      outerShellsGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.18,
            wireframe: false,
          });
        }
      });
      // Show internal machinery
      internalMachineryGroupRef.current.visible = true;
      flowTubesGroupRef.current.visible = false;
    } else if (visualMode === "SYSTEM") {
      // Restore solid shells but dimmed
      outerShellsGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.5,
            metalness: 0.2,
            transparent: true,
            opacity: 0.45,
          });
        }
      });
      internalMachineryGroupRef.current.visible = true;
      flowTubesGroupRef.current.visible = true;
    } else if (visualMode === "HEAT MAP") {
      // Color by thermal dissipation gradient
      outerShellsGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xf59e0b, // Warm thermal radiation
            roughness: 0.4,
            metalness: 0.1,
          });
        }
      });
      internalMachineryGroupRef.current.visible = false;
      flowTubesGroupRef.current.visible = false;
    } else {
      // NORMAL mode: restore realistic opaque materials
      outerShellsGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.35,
            metalness: 0.15,
            transparent: false,
            opacity: 1.0,
          });
        }
      });
      internalMachineryGroupRef.current.visible = false;
      flowTubesGroupRef.current.visible = false;
    }
  }, [visualMode]);

  const selectedAssetNode = assetNodesRef.current.find((n) => n.assetId === selectedAssetId);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", userSelect: "none" }}>
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD OVERLAY BAR 1: TOP MODES & CONTROLS (Screenshots 1, 2, 4)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: "0.75rem",
          left: "0.75rem",
          right: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {/* Visual Mode Buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.3rem",
            backgroundColor: "rgba(255, 255, 255, 0.88)",
            padding: "0.25rem 0.4rem",
            borderRadius: "4px",
            border: "1px solid rgba(0,0,0,0.12)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            pointerEvents: "auto",
          }}
        >
          {(["NORMAL", "X-RAY", "SYSTEM", "HEAT MAP", "FORECAST", "REPLAY"] as TwinVisualMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onVisualModeChange?.(mode)}
              style={{
                border: "none",
                background: visualMode === mode ? "#0b4a35" : "transparent",
                color: visualMode === mode ? "#ffffff" : "#475569",
                fontWeight: visualMode === mode ? 700 : 500,
                fontSize: "0.68rem",
                padding: "0.25rem 0.6rem",
                borderRadius: "3px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {mode} {mode === "REPLAY" && "•"}
            </button>
          ))}
        </div>

        {/* View Controls & Toggles */}
        <div
          style={{
            display: "flex",
            gap: "0.35rem",
            backgroundColor: "rgba(255, 255, 255, 0.88)",
            padding: "0.25rem 0.4rem",
            borderRadius: "4px",
            border: "1px solid rgba(0,0,0,0.12)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            pointerEvents: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => setSensorsEnabled((s) => !s)}
            style={{
              border: "1px solid rgba(0,0,0,0.1)",
              background: sensorsEnabled ? "rgba(20, 107, 74, 0.12)" : "transparent",
              color: sensorsEnabled ? "#0b4a35" : "#64748b",
              fontWeight: 600,
              fontSize: "0.68rem",
              padding: "0.25rem 0.55rem",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            SENSORS: {sensorsEnabled ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => setLabelsEnabled((l) => !l)}
            style={{
              border: "1px solid rgba(0,0,0,0.1)",
              background: labelsEnabled ? "rgba(20, 107, 74, 0.12)" : "transparent",
              color: labelsEnabled ? "#0b4a35" : "#64748b",
              fontWeight: 600,
              fontSize: "0.68rem",
              padding: "0.25rem 0.55rem",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            LABELS: {labelsEnabled ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={handleResetView}
            style={{
              border: "1px solid rgba(0,0,0,0.1)",
              background: "transparent",
              color: "#475569",
              fontWeight: 600,
              fontSize: "0.68rem",
              padding: "0.25rem 0.55rem",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            RESET VIEW
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD OVERLAY BAR 2: INFRASTRUCTURE ASSETS QUICK SELECT           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: "3.2rem",
          left: "0.75rem",
          right: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          overflowX: "auto",
          pointerEvents: "auto",
          backgroundColor: "rgba(255, 255, 255, 0.88)",
          padding: "0.3rem 0.6rem",
          borderRadius: "4px",
          border: "1px solid rgba(0,0,0,0.1)",
          zIndex: 9,
        }}
      >
        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap", marginRight: "0.2rem" }}>
          INFRASTRUCTURE ASSETS:
        </span>
        {[
          { id: isMaitri ? "asset-maitri-bat-1" : "asset-bharati-bat-1", label: "BATTERY BANK A" },
          { id: isMaitri ? "asset-maitri-bat-1" : "asset-bharati-bat-1", label: "BATTERY BANK B" },
          { id: isMaitri ? "asset-maitri-sol-1" : "asset-bharati-chp-1", label: "MICROGRID INV." },
          { id: isMaitri ? "asset-maitri-gen-1" : "asset-bharati-chp-1", label: "HV TRANSFORMER" },
          { id: isMaitri ? "asset-maitri-gen-1" : "asset-bharati-chp-1", label: "DIESEL GEN #1" },
          { id: isMaitri ? "asset-maitri-gen-2" : "asset-bharati-chp-2", label: "DIESEL GEN #2" },
          { id: isMaitri ? "asset-maitri-water-1" : "asset-bharati-ro-1", label: "DAY TANK" },
          { id: isMaitri ? "asset-maitri-hvac-1" : "asset-bharati-hvac-1", label: "HVAC UNIT A" },
          { id: isMaitri ? "asset-maitri-env-1" : "asset-bharati-env-1", label: "MET ARRAY" },
          { id: isMaitri ? "asset-maitri-water-1" : "asset-bharati-ro-1", label: "CRYO FREEZER" },
        ].map((item, idx) => {
          const isSelected = selectedAssetId === item.id;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectAsset(item.id)}
              style={{
                border: "1px solid rgba(0,0,0,0.15)",
                background: isSelected ? "#0b4a35" : "#ffffff",
                color: isSelected ? "#ffffff" : "#334155",
                fontSize: "0.62rem",
                fontWeight: 600,
                padding: "0.2rem 0.5rem",
                borderRadius: "3px",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* X-RAY / SYSTEM MODE BANNER NOTIFICATIONS                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {visualMode === "X-RAY" && (
        <div
          style={{
            position: "absolute",
            top: "5.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(254, 243, 199, 0.95)",
            border: "1px solid #f59e0b",
            color: "#b45309",
            fontWeight: 700,
            fontSize: "0.72rem",
            padding: "0.25rem 0.8rem",
            borderRadius: "4px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            zIndex: 10,
            letterSpacing: "0.04em",
          }}
        >
          👁 X-RAY MODE — INTERNAL INFRASTRUCTURE & MACHINERY VISIBLE
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3D FLOATING ASSET TAGS / BADGES (Screenshots 1, 2, 4, 5)        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {labelsEnabled &&
        projectedTags.map((tag) => {
          if (!tag.visible) return null;
          const isSelected = selectedAssetId === tag.assetId;
          return (
            <div
              key={tag.assetId}
              onClick={() => {
                onSelectAsset(tag.assetId);
                setConsoleOpen(true);
              }}
              style={{
                position: "absolute",
                left: `${tag.x}px`,
                top: `${tag.y}px`,
                transform: "translate(-50%, -50%)",
                backgroundColor: isSelected ? "#06b6d4" : "rgba(15, 23, 42, 0.88)",
                color: isSelected ? "#0f172a" : "#f8fafc",
                border: isSelected ? "1px solid #22d3ee" : "1px solid rgba(56, 189, 248, 0.3)",
                padding: "0.18rem 0.45rem",
                borderRadius: "3px",
                fontSize: "0.62rem",
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                cursor: "pointer",
                zIndex: 8,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                transition: "transform 0.1s ease",
              }}
              title={`Click to inspect ${tag.label}`}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: tag.status === "FAILED" ? "#ef4444" : tag.status === "WARNING" ? "#f59e0b" : "#22c55e",
                  display: "inline-block",
                }}
              />
              <span>{tag.label}</span>
            </div>
          );
        })}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD WIDGET 1: TOP-LEFT STATION STATUS HUD (Screenshot 1)        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: "5.5rem",
          left: "0.75rem",
          width: "210px",
          backgroundColor: "rgba(13, 23, 33, 0.88)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          padding: "0.75rem 0.85rem",
          color: "#f8fafc",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: "#94a3b8" }}>
            • STATION STATUS HUD
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ position: "relative", width: "48px", height: "48px" }}>
            {/* SVG Circular Radial Progress */}
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke={avgHealth > 85 ? "#10b981" : avgHealth > 60 ? "#f97316" : "#ef4444"}
                strokeWidth="4"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 * (1 - Math.min(100, Math.max(0, avgHealth)) / 100)}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#f8fafc",
              }}
            >
              {avgHealth}%
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.6rem", color: "#94a3b8", textTransform: "uppercase" }}>System Health</div>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: avgHealth > 85 ? "#10b981" : avgHealth > 60 ? "#f97316" : "#ef4444",
              }}
            >
              {avgHealth}%
            </div>
            <div style={{ fontSize: "0.58rem", color: "#64748b" }}>Subsystem condition</div>
          </div>
        </div>

        <div
          style={{
            marginTop: "0.6rem",
            paddingTop: "0.4rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.62rem",
          }}
        >
          <span style={{ color: "#94a3b8" }}>
            {twinState?.assets?.length ? `${twinState.assets.length} MODULES ACTIVE` : "6 MODULES ACTIVE"}
          </span>
          <span
            style={{
              color: stationStatus === "OPERATIONAL" ? "#10b981" : stationStatus === "DEGRADED" ? "#f97316" : "#ef4444",
              fontWeight: 700,
            }}
          >
            READINESS: {stationStatus}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD WIDGET 2: BOTTOM-LEFT ASK THE TWIN (Screenshot 1, 2)        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          bottom: "3.4rem",
          left: "0.75rem",
          width: "290px",
          backgroundColor: "rgba(13, 23, 33, 0.92)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "6px",
          padding: "0.75rem 0.85rem",
          color: "#f8fafc",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f8fafc" }}>• ASK THE TWIN</span>
          <span style={{ fontSize: "0.58rem", color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>
            {isMaitri ? "MTR • TELEMETRY CLI" : "BHR • TELEMETRY CLI"}
          </span>
        </div>

        {/* CLI Input */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.5rem" }}>
          <input
            type="text"
            value={cliInput}
            onChange={(e) => setCliInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cliInput.trim() && onAskTwin) {
                onAskTwin(cliInput);
                setCliInput("");
              }
            }}
            placeholder="> Ask station telemetry (fuel, battery, power...)"
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "3px",
              padding: "0.25rem 0.4rem",
              color: "#f8fafc",
              fontSize: "0.62rem",
              fontFamily: "var(--font-mono, monospace)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (cliInput.trim() && onAskTwin) {
                onAskTwin(cliInput);
                setCliInput("");
              }
            }}
            style={{
              backgroundColor: "#ea580c",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
              padding: "0.25rem 0.5rem",
              fontSize: "0.6rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            EXEC ↵
          </button>
        </div>

        {/* Quick query suggestion chips */}
        <div style={{ fontSize: "0.58rem", color: "#94a3b8", marginBottom: "0.3rem" }}>COMMON OPERATIONAL QUERIES:</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
          {[
            "Days of fuel left?",
            "What is battery level?",
            "What if wind drops 20%?",
            "Is station at risk?",
          ].map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAskTwin && onAskTwin(q)}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "3px",
                padding: "0.2rem 0.35rem",
                color: "#cbd5e1",
                fontSize: "0.58rem",
                textAlign: "left",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD WIDGET 3: TOP-RIGHT ENVIRONMENTAL FEED (Screenshots 1, 2)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          top: "5.5rem",
          right: "0.75rem",
          width: "200px",
          backgroundColor: "rgba(13, 23, 33, 0.88)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          padding: "0.75rem 0.85rem",
          color: "#f8fafc",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.4rem" }}>
          ☁ ENVIRONMENTAL FEED
        </div>

        <div style={{ marginBottom: "0.4rem" }}>
          <div style={{ fontSize: "0.58rem", color: "#64748b" }}>WIND SPEED (SSE [158°])</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f8fafc" }}>
            {windSpeedMs.toFixed(1)} <span style={{ fontSize: "0.68rem" }}>m/s</span>{" "}
            <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>({(windSpeedMs * 3.6).toFixed(1)} km/h)</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginBottom: "0.4rem" }}>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#64748b" }}>EXT TEMP</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>
              {twinState?.environment?.ambientTempC !== undefined
                ? `${twinState.environment.ambientTempC.toFixed(1)}°C`
                : "-18.4°C"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#64748b" }}>FEELS LIKE</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#60a5fa" }}>
              {twinState?.environment?.ambientTempC !== undefined
                ? `${(twinState.environment.ambientTempC - (windSpeedMs || 11.8) * 0.7).toFixed(1)}°C`
                : "-28.1°C"}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.58rem", color: "#64748b" }}>ATMOSPHERIC PRESSURE</div>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1" }}>
            {twinState?.environment?.atmosphericPressureHpa !== undefined
              ? `${twinState.environment.atmosphericPressureHpa.toFixed(1)} hPa`
              : "986.2 hPa"}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD WIDGET 4: BOTTOM-RIGHT REAL-TIME EVENT LOG (Screenshot 1)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          bottom: "3.4rem",
          right: "0.75rem",
          width: "270px",
          backgroundColor: "rgba(13, 23, 33, 0.88)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          padding: "0.65rem 0.8rem",
          color: "#f8fafc",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.3rem" }}>
          • REAL-TIME EVENT LOG
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.6rem", color: "#cbd5e1" }}>
          {twinState?.activeAlerts && twinState.activeAlerts.length > 0 ? (
            twinState.activeAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                style={{
                  color: alert.severity === "CRITICAL" ? "#f87171" : "#fde047",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                • {alert.title || alert.description}
              </div>
            ))
          ) : (
            <>
              <div>• Battery Bank A: FLOAT ({avgHealth}%)</div>
              <div>• Solar PV Array: Gen 54.2 kW load nominal</div>
              <div>• Expedition Airlock: Biometric pressure stabilized</div>
            </>
          )}
        </div>
        <div
          style={{
            marginTop: "0.4rem",
            paddingTop: "0.3rem",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: "0.55rem",
            color: "#64748b",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>L-CLICK: ROTATE</span>
          <span>R-CLICK: PAN</span>
          <span>SCROLL: ZOOM</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SLIDE-OUT COMMAND CONSOLE DRAWER (Right Edge, Screenshot 1)    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {consoleOpen && selectedAssetNode && (
        <div
          style={{
            position: "absolute",
            top: "5.5rem",
            right: "0.75rem",
            width: "320px",
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            zIndex: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.6rem 0.85rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#f8fafc",
            }}
          >
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#0b4a35" }}>• COMMAND CONSOLE</div>
              <div style={{ fontSize: "0.58rem", color: "#64748b" }}>
                MAIN ZONE — {selectedAssetNode.assetId.toUpperCase()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConsoleOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                fontSize: "1.1rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Running vs Control Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => setConsoleTab("RUNNING")}
              style={{
                flex: 1,
                padding: "0.4rem",
                fontSize: "0.68rem",
                fontWeight: 600,
                border: "none",
                borderBottom: consoleTab === "RUNNING" ? "2px solid #0b4a35" : "none",
                background: "transparent",
                color: consoleTab === "RUNNING" ? "#0b4a35" : "#64748b",
                cursor: "pointer",
              }}
            >
              RUNNING
            </button>
            <button
              type="button"
              onClick={() => setConsoleTab("CONTROL")}
              style={{
                flex: 1,
                padding: "0.4rem",
                fontSize: "0.68rem",
                fontWeight: 600,
                border: "none",
                borderBottom: consoleTab === "CONTROL" ? "2px solid #0b4a35" : "none",
                background: "transparent",
                color: consoleTab === "CONTROL" ? "#0b4a35" : "#64748b",
                cursor: "pointer",
              }}
            >
              CONTROL
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: "0.85rem", maxHeight: "340px", overflowY: "auto" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.2rem" }}>
              {selectedAssetNode.name}
            </div>
            <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "0.6rem" }}>
              Type: {selectedAssetNode.type} | Category: {selectedAssetNode.category}
            </div>

            <div
              style={{
                padding: "0.4rem 0.6rem",
                borderRadius: "4px",
                backgroundColor: "#f1f5f9",
                marginBottom: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.7rem", color: "#475569" }}>Status:</span>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: selectedAssetNode.status === "FAILED" ? "#b33a3a" : "#146b4a",
                }}
              >
                ● {selectedAssetNode.status}
              </span>
            </div>

            {/* Health Bar */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginBottom: "0.25rem" }}>
                <span>Health Score:</span>
                <strong>{selectedAssetNode.health}%</strong>
              </div>
              <div style={{ height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${selectedAssetNode.health}%`,
                    backgroundColor: selectedAssetNode.health > 80 ? "#146b4a" : "#b7791f",
                  }}
                />
              </div>
            </div>

            {consoleTab === "CONTROL" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => alert(`Simulated diagnostic cycle initiated for ${selectedAssetNode.name}.`)}
                  style={{
                    backgroundColor: "#0b4a35",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ⚡ Run Diagnostic Cycle
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Failover isolation procedure tested for ${selectedAssetNode.name}.`)}
                  style={{
                    backgroundColor: "transparent",
                    color: "#0b4a35",
                    border: "1px solid #0b4a35",
                    borderRadius: "4px",
                    padding: "0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔒 Test Failover Isolation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HUD BOTTOM BAR: T1–T7 VERIFICATION TEST SEQUENCE (Screenshot 1)  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: "absolute",
          bottom: "0.5rem",
          left: "0.75rem",
          right: "0.75rem",
          backgroundColor: "rgba(255, 255, 255, 0.94)",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: "4px",
          padding: "0.3rem 0.6rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          zIndex: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", overflowX: "auto" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>
            * OPERATIONAL VERIFICATION & TEST SEQUENCE (T1-T7):
          </span>
          {[
            { key: "T1: NORMAL", label: "T1: NORMAL" },
            { key: "T2: WARNING", label: "T2: WARNING" },
            { key: "T3: CRITICAL", label: "T3: CRITICAL" },
            { key: "T4: OFFLINE", label: "T4: OFFLINE" },
            { key: "T5: RECOVERY", label: "T5: RECOVERY" },
            { key: "T6: SELECT SENSOR", label: "T6: SELECT SENSOR" },
            { key: "T7: SWITCH STATION", label: "T7: SWITCH STATION" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTriggerTest && onTriggerTest(t.key)}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#f8fafc",
                color: "#334155",
                fontSize: "0.6rem",
                fontWeight: 600,
                padding: "0.15rem 0.45rem",
                borderRadius: "3px",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: "0.58rem", color: "#94a3b8", whiteSpace: "nowrap", marginLeft: "0.5rem" }}>
          Targeted State & Telemetry Validation
        </div>
      </div>
    </div>
  );
}
