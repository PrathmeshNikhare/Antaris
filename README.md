# Maitri & Bharati — Antarctic Digital Twin

<p align="center">
  <strong>Offline-First Digital Twin & Remote Operations Platform for India's Antarctic Research Stations</strong>
</p>

<p align="center">
  Smart India Hackathon · Ministry of Earth Sciences (MoES / NCPOR)
</p>

<p align="center">
  <a href="packages/shared/package.json"><img src="https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="apps/api/package.json"><img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="apps/web/package.json"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React"></a>
  <a href="docker-compose.yml"><img src="https://img.shields.io/badge/TimescaleDB-PostgreSQL_16-FDB515?logo=postgresql&logoColor=white" alt="TimescaleDB"></a>
  <a href="docker-compose.yml"><img src="https://img.shields.io/badge/MQTT-Mosquitto_2-660066?logo=eclipsemosquitto&logoColor=white" alt="MQTT"></a>
  <a href="apps/api/src/copilot/copilot.service.ts"><img src="https://img.shields.io/badge/Ollama-gemma4%3Ae2b-FF6F00?logo=google&logoColor=white" alt="Offline LLM"></a>
  <a href="docker-compose.yml"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
</p>

**Status:** Local demo implemented with digital twin state management, telemetry ingestion, dependency analysis, what-if simulation, operations dashboard, offline LLM copilot, and audit logging.

---

## 🚀 Overview

Antarctic research stations operate under extreme weather, limited connectivity, and mission-critical infrastructure dependencies.

**Maitri-Bharati** provides a digital representation of India's:
- **Maitri** — Schirmacher Oasis
- **Bharati** — Larsemann Hills

It combines telemetry, digital twin state, dependency graphs, anomaly detection, energy/logistics monitoring, and isolated what-if simulations in one operations console.

The optional local LLM provides advisory explanations and checklists. It does not directly control physical equipment.

---

## 🎯 Why Maitri-Bharati?

A conventional dashboard shows *what is happening*.

Maitri-Bharati also helps answer: **"What happens if this component fails?"**

| Capability | Purpose |
|---|---|
| **Digital Twin** | Maintains station and asset state |
| **Dependency Graph** | Models subsystem relationships |
| **Cascade Analysis** | Identifies downstream failure impacts |
| **What-If Simulation** | Tests failures without changing live state |
| **Energy & Logistics** | Tracks power, fuel and resources |
| **Anomaly Detection** | Identifies abnormal telemetry |
| **Offline Copilot** | Provides local explanations and checklists |
| **Audit Logging** | Records important operator actions |

---

## 🏗️ Architecture

```text
Telemetry / Simulator
        ↓
   MQTT Broker
        ↓
Express API + Digital Twin
        ↓
 ┌──────┴────────┐
 ↓               ↓
TimescaleDB   Analytics
                 ↓
          Dependency Graph
                 ↓
          What-If Simulation
                 ↓
          React + Three.js
                 ↓
        Local Ollama LLM
           (Advisory)
```

**Key design principles:**
- **Offline-first** — core functionality runs locally.
- **Deterministic** — twin and simulation logic is inspectable.
- **Isolated simulation** — what-if scenarios never mutate live state.
- **Human-in-the-loop** — LLM output is advisory only.
- **Low-latency telemetry** — MQTT + WebSocket updates.

---

## ⚙️ Core Features

### Digital Twin & Monitoring
- Station and asset state management
- Energy and microgrid monitoring
- HVAC and life-support monitoring
- Environmental telemetry
- Real-time WebSocket updates

### Intelligence
- Statistical and threshold-based anomaly detection
- Dependency-based cascade analysis
- Energy and logistics forecasting
- Station health/risk evaluation

### What-If Simulation

Simulates scenarios such as:
- Generator failure
- Battery degradation
- Fuel shortage
- Extreme cold
- High wind
- Communication outage
- Backup generator activation

All scenarios execute in an isolated state.

### Offline AI Copilot

Local `gemma4:e2b` through Ollama provides:
- Incident explanations
- Telemetry summaries
- Operational checklists

It cannot directly actuate equipment.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, TypeScript, Express |
| **Frontend** | React 19, TypeScript, Vite |
| **Realtime** | WebSockets |
| **Telemetry** | MQTT / Mosquitto |
| **Database** | PostgreSQL 16 + TimescaleDB |
| **3D** | Three.js |
| **Offline AI** | Gemma 4 via Ollama |
| **Containers** | Docker Compose |
| **Testing** | Vitest, Supertest, React Testing Library |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+
- **npm**
- **Docker + Docker Compose**
- **Ollama** (optional, for the copilot)

### Local Development

```bash
# Start database and MQTT
docker compose up -d db mqtt

# Install dependencies
npm install

# Setup database
npm run db:setup

# Start API
npm run dev:api
```

In another terminal:

```bash
npm run dev:web
```

Open: `http://localhost:5173`

API: `http://localhost:3001`

### Docker

```bash
docker compose up -d
```

---

## 🤖 Optional Offline Copilot

```bash
ollama serve
ollama pull gemma4:e2b
```

Ollama runs locally at: `http://localhost:11434`

The core digital twin and simulation engine do not depend on the LLM.

---

## 📁 Repository Structure

```
Maitri-Bharti/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── copilot/
│   │       ├── intelligence/
│   │       ├── logistics/
│   │       ├── simulation/
│   │       ├── telemetry/
│   │       └── twin/
│   └── web/
│       └── src/
│           ├── components/
│           └── features/
├── packages/
│   └── shared/
├── docker/
└── docker-compose.yml
```

---

## 📌 Project Status

- [x] Digital twin engine
- [x] MQTT telemetry ingestion
- [x] PostgreSQL + TimescaleDB
- [x] Dependency propagation
- [x] Anomaly detection
- [x] Energy & logistics monitoring
- [x] What-if simulation
- [x] React + Three.js console
- [x] Offline Ollama copilot
- [x] Audit logging

---

## 🏆 Project Goal

> Don't just monitor the station. Maintain its digital representation, understand its dependencies, simulate failures before they happen, and support operators with local intelligence.

<p align="center">
  <em>Smart India Hackathon · Ministry of Earth Sciences (MoES / NCPOR)</em>
</p>
