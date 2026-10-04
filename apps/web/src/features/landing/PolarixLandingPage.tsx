import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { useStation } from "../../hooks/useStation";

export function PolarixLandingPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { stationId, setStationId, twinState } = useStation();

  // Active station in landing terminal ("station-maitri" | "station-bharati")
  const [selectedStation, setSelectedStation] = useState<"station-maitri" | "station-bharati">(
    (stationId as "station-maitri" | "station-bharati") || "station-maitri"
  );

  // Live ticking UTC Clock
  const [utcTime, setUtcTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcTime(`UTC ${h}:${m}:${s}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync station selection with context
  const handleSelectStation = (id: "station-maitri" | "station-bharati") => {
    setSelectedStation(id);
    setStationId(id);
  };

  const isMaitri = selectedStation === "station-maitri";

  // Telemetry metrics (fallback to nominal polar benchmarks if live twinState is syncing)
  const envTemp = isMaitri
    ? (twinState?.environment?.ambientTempC !== undefined ? `${twinState.environment.ambientTempC.toFixed(1)}°C` : "-28.4°C")
    : "-18.2°C";

  const windKnots = isMaitri
    ? (twinState?.environment?.windSpeedMs !== undefined ? (twinState.environment.windSpeedMs * 1.94384).toFixed(1) : "42.5")
    : "28.6";

  const powerKw = isMaitri
    ? (twinState?.energy?.totalLoadKw !== undefined ? `${twinState.energy.totalLoadKw.toFixed(1)} kW` : "84.3 kW")
    : "92.6 kW";

  const batterySoc = isMaitri
    ? (twinState?.energy?.batterySocPct !== undefined ? Math.round(twinState.energy.batterySocPct) : 78)
    : 88;

  // ─── Three.js Holographic Wireframe Station Canvas ─────────────────
  const canvasMountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060d17, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(16, 12, 28);
    camera.lookAt(0, 2, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.innerHTML = "";
      container.appendChild(renderer.domElement);
    } catch {
      // jsdom or headless environment without WebGL support
      return;
    }

    // Cyan glowing wireframe material
    const wireMatCyan = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    const wireMatAccent = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });

    const nodeGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const stationGroup = new THREE.Group();
    scene.add(stationGroup);

    // 1. Central habitat module
    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 9), wireMatCyan);
    mainBox.position.set(2, 3.5, 0);
    stationGroup.add(mainBox);

    // 2. Elevated Stilts
    const stiltPositions = [
      [-4, -4], [8, -4], [-4, 4], [8, 4], [2, -4], [2, 4],
    ];
    stiltPositions.forEach(([sx, sz]) => {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), wireMatCyan);
      stilt.position.set(sx + 2, 1.5, sz);
      stationGroup.add(stilt);
    });

    // 3. Side modules & corridors
    const modLeft = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 6), wireMatCyan);
    modLeft.position.set(-9, 3, -1);
    const modRight = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 7), wireMatCyan);
    modRight.position.set(14, 3, 2);
    stationGroup.add(modLeft, modRight);

    // Connecting Skyways
    const skyway1 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 2), wireMatCyan);
    skyway1.position.set(-3.5, 3.5, -0.5);
    const skyway2 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 2), wireMatCyan);
    skyway2.position.set(10, 3.5, 1);
    stationGroup.add(skyway1, skyway2);

    // 4. Parabolic Satellite Dishes & Comms Mast
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
      wireMatAccent
    );
    dish.position.set(14, 6.5, 2);
    dish.rotation.x = -0.9;
    stationGroup.add(dish);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 11, 6), wireMatCyan);
    mast.position.set(3, 9, -2);
    stationGroup.add(mast);

    // 5. Holographic Glowing Vertices / Sensor Nodes
    const nodeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const nodeCoords = [
      [2, 6.5, 0], [-9, 5.5, -1], [14, 5.5, 2], [3, 14.5, -2],
      [-4, 3.5, 4.5], [8, 3.5, 4.5], [-9, 3, 2], [14, 8, 2],
    ];
    nodeCoords.forEach(([nx, ny, nz]) => {
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeGlowMat);
      nodeMesh.position.set(nx, ny, nz);
      stationGroup.add(nodeMesh);
    });

    // 6. Ground coordinate mesh plane
    const groundGrid = new THREE.GridHelper(120, 40, 0x1e3a5f, 0x0f2338);
    groundGrid.position.y = 0;
    scene.add(groundGrid);

    // 7. Drifting Blizzard / Snow Particles
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 80;
      particlePos[i * 3 + 1] = Math.random() * 25;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.16,
      transparent: true,
      opacity: 0.65,
    });
    const snowParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(snowParticles);

    // Mouse parallax tracking
    let targetRotY = 0;
    let targetRotX = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth) * 2 - 1;
      const my = -(e.clientY / window.innerHeight) * 2 + 1;
      targetRotY = mx * 0.12;
      targetRotX = my * 0.08;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Subtle parallax camera rotation
      stationGroup.rotation.y += (targetRotY - stationGroup.rotation.y) * 0.04;
      stationGroup.rotation.x += (targetRotX - stationGroup.rotation.x) * 0.04;

      // Drift snow particles
      const pos = particleGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let py = pos.getY(i) - 0.05;
        let px = pos.getX(i) + 0.08;
        if (py < 0) py = 25;
        if (px > 40) px = -40;
        pos.setXY(i, px, py);
      }
      pos.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        minHeight: "100vh",
        backgroundColor: "#060d17",
        backgroundImage: `
          radial-gradient(ellipse at 80% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 60%),
          radial-gradient(ellipse at 20% 80%, rgba(30, 58, 95, 0.25) 0%, transparent 70%),
          linear-gradient(180deg, #050b14 0%, #081321 65%, #050b14 100%)
        `,
        color: "#f8fafc",
        fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "2.5rem 3.5rem",
        boxSizing: "border-box",
      }}
    >
      {/* 3D Holographic Canvas Mount */}
      <div
        ref={canvasMountRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.85,
        }}
      />

      {/* Subtle Mountain Range Horizon Silhouette Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "38vh",
          backgroundImage: `linear-gradient(to top, rgba(6, 13, 23, 0.95) 0%, rgba(6, 13, 23, 0.4) 60%, transparent 100%)`,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TOP HEADER: PRIMARY STATION CONTEXT BADGE                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <header style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.55rem",
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "4px",
            padding: "0.35rem 0.85rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#f97316",
              boxShadow: "0 0 8px #f97316",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#94a3b8",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
            }}
          >
            • PRIMARY STATION CONTEXT &nbsp;
            <span style={{ color: "#f8fafc" }}>
              {isMaitri ? "MAITRI • MTR / SCHIRMACHER OASIS" : "BHARATI • BHR / LARSEMANN HILLS"}
            </span>
          </span>
        </div>

        {/* Top-Right Direct Mission Control Link */}
        <button
          type="button"
          onClick={() => navigate("/overview")}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#e2e8f0",
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "0.4rem 0.9rem",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
            e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
          }}
        >
          <span>Operations Console</span>
          <span style={{ color: "#38bdf8" }}>→</span>
        </button>
      </header>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MAIN HERO CONTENT: POLARIX BRANDING & CTA BUTTONS               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <main
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "680px",
          marginTop: "auto",
          marginBottom: "auto",
          paddingBottom: "2rem",
        }}
      >
        {/* Brand Title: POLARIX */}
        <h1
          style={{
            fontSize: "clamp(3.8rem, 8vw, 5.8rem)",
            fontWeight: 900,
            letterSpacing: "0.24em",
            lineHeight: 1.05,
            margin: "0 0 0.8rem 0",
            color: "#ffffff",
            backgroundImage: "linear-gradient(180deg, #ffffff 40%, #bae6fd 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 40px rgba(56, 189, 248, 0.25)",
            fontFamily: "var(--font-sans, -apple-system, sans-serif)",
          }}
        >
          POLARIX
        </h1>

        {/* Subtitle: — ANTARCTIC DIGITAL TWIN — */}
        <div
          style={{
            fontSize: "clamp(0.85rem, 1.8vw, 1.05rem)",
            fontWeight: 700,
            letterSpacing: "0.32em",
            color: "#38bdf8",
            marginBottom: "1.5rem",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
          }}
        >
          <span style={{ width: "32px", height: "1px", backgroundColor: "#38bdf8", opacity: 0.6 }} />
          <span>ANTARCTIC DIGITAL TWIN</span>
          <span style={{ width: "32px", height: "1px", backgroundColor: "#38bdf8", opacity: 0.6 }} />
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: "clamp(1rem, 1.6vw, 1.18rem)",
            lineHeight: 1.6,
            color: "#cbd5e1",
            maxWidth: "540px",
            margin: "0 0 2.2rem 0",
            fontWeight: 400,
          }}
        >
          Digital Platform for Efficient Remote Management of Indian Antarctic Research Stations
        </p>

        {/* Action Buttons: Enter Mission Control + Explore Digital Twin */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          {/* Primary CTA Button: ENTER MISSION CONTROL */}
          <button
            type="button"
            onClick={() => navigate("/overview")}
            style={{
              background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
              color: "#ffffff",
              border: "1px solid rgba(251, 146, 60, 0.4)",
              borderRadius: "4px",
              padding: "0.85rem 1.65rem",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              boxShadow: "0 4px 20px rgba(234, 88, 12, 0.35)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 28px rgba(234, 88, 12, 0.55)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(234, 88, 12, 0.35)";
            }}
          >
            <span>ENTER MISSION CONTROL</span>
            <span
              style={{
                backgroundColor: "rgba(0,0,0,0.2)",
                borderRadius: "3px",
                padding: "0.15rem 0.35rem",
                fontSize: "0.75rem",
                display: "inline-flex",
              }}
            >
              ↗
            </span>
          </button>

          {/* Secondary CTA Button: EXPLORE DIGITAL TWIN */}
          <button
            type="button"
            onClick={() => navigate("/twin")}
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(10px)",
              color: "#f1f5f9",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "4px",
              padding: "0.85rem 1.65rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.95)";
              e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.65)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.75)";
              e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.35)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={{ color: "#38bdf8" }}>✦</span>
            <span>EXPLORE DIGITAL TWIN</span>
          </button>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FLOATING HUD: STATION TELEMETRY TERMINAL (Bottom-Right)         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <aside
        style={{
          position: "fixed",
          bottom: "2.5rem",
          right: "3.5rem",
          width: "420px",
          backgroundColor: "rgba(11, 19, 30, 0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "8px",
          padding: "1.1rem 1.25rem",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.65)",
          zIndex: 20,
        }}
      >
        {/* Terminal Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.85rem" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#f97316",
              boxShadow: "0 0 6px #f97316",
            }}
          />
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#94a3b8",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
            }}
          >
            STATION TELEMETRY TERMINAL
          </span>
        </div>

        {/* Station Selection Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.35rem",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            padding: "0.2rem",
            borderRadius: "4px",
            marginBottom: "0.9rem",
          }}
        >
          <button
            type="button"
            onClick={() => handleSelectStation("station-maitri")}
            style={{
              border: "none",
              backgroundColor: isMaitri ? "#ea580c" : "transparent",
              color: isMaitri ? "#ffffff" : "#94a3b8",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "0.35rem",
              borderRadius: "3px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            MAITRI (MTR)
          </button>
          <button
            type="button"
            onClick={() => handleSelectStation("station-bharati")}
            style={{
              border: "none",
              backgroundColor: !isMaitri ? "#ea580c" : "transparent",
              color: !isMaitri ? "#ffffff" : "#94a3b8",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "0.35rem",
              borderRadius: "3px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            BHARATI (BHR)
          </button>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "0.9rem" }}>
          {/* Row 1: Coordinates & Elevation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.55rem", color: "#64748b", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
                COORDINATES
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                {isMaitri ? "70°45'57\"S 11°44'09\"E" : "69°24'28\"S 76°11'14\"E"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.55rem", color: "#64748b", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
                ELEVATION / REGION
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                {isMaitri ? "117 M ASL • SCHIRMACHER" : "35 M ASL • LARSEMANN"}
              </div>
            </div>
          </div>

          {/* Row 2: Ambient Temp & Katabatic Wind */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.55rem", color: "#64748b", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
                AMBIENT TEMP
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8", fontFamily: "var(--font-mono, monospace)" }}>
                  {envTemp}
                </span>
                <span style={{ fontSize: "0.55rem", color: "#94a3b8" }}>POLAR DESERT</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.55rem", color: "#64748b", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
                KATABATIC WIND
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono, monospace)" }}>
                  {windKnots}
                </span>
                <span style={{ fontSize: "0.55rem", color: "#94a3b8" }}>KNOTS • WATCH</span>
              </div>
            </div>
          </div>

          {/* Row 3: Power Demand & Battery Storage */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.55rem", color: "#64748b", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
                POWER DEMAND
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                  {powerKw}
                </span>
                <span style={{ fontSize: "0.55rem", color: "#64748b" }}>STATION LOAD</span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.55rem", color: "#64748b", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                <span>BATTERY STORAGE</span>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>{batterySoc}% SOC</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${batterySoc}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0284c7 0%, #10b981 100%)",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Divider & Satellite Link Status */}
        <div
          style={{
            paddingTop: "0.6rem",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.6rem",
            color: "#64748b",
            fontFamily: "var(--font-mono, monospace)",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ color: "#38bdf8", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span>📶</span> SATELLITE L-BAND // 1420.4 MHz
          </span>
          <span style={{ color: "#cbd5e1" }}>{utcTime || "UTC --:--:--"}</span>
        </div>

        {/* Quick Nav Chips */}
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {[
            { label: "3D DIGITAL TWIN ↗", path: "/twin" },
            { label: "MICROGRID ↗", path: "/energy" },
            { label: "SYSTEM ALERTS ↗", path: "/alerts" },
          ].map((chip) => (
            <button
              key={chip.path}
              type="button"
              onClick={() => navigate(chip.path)}
              style={{
                flex: 1,
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "3px",
                padding: "0.3rem 0.2rem",
                color: "#cbd5e1",
                fontSize: "0.58rem",
                fontWeight: 600,
                textAlign: "center",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(56, 189, 248, 0.12)";
                e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
                e.currentTarget.style.color = "#38bdf8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "#cbd5e1";
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
