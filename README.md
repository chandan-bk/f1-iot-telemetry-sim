# Formula 1 IoT Telemetry & Racing Simulator

> **College Engineering Capstone Project:**  
> *"Application of IoT in Motorsport: Real-Time Race Car Telemetry Monitoring and Performance Analysis"*

A fully playable, visually impressive 3D Formula-style motorsport racing game tightly integrated with a real-time IoT telemetry monitoring and race engineering analytics suite.

---

## 🌟 Key Features

1. **High-Fidelity 3D Racing Environment (Three.js WebGL)**:
   - "Albert Grand Prix Ring" circuit with 3D curbs, tarmac runoffs, distance braking marker boards, sponsor barriers, grandstands, and a 5-light start gantry.
   - Procedural Formula 1 single-seater cars with front/rear aerodynamic wings, animated DRS flap, halo safety structure, glowing carbon-ceramic brake rotors, and distinct team liveries (Apex Racing, Scuderia Veloce, CyberGP).
   - Dynamic Chase Camera and Onboard T-Cam / Cockpit Camera options.
   - Procedural Web Audio API sound synthesizer: 1.6L V6 turbo engine pitch, turbocharger whistle, rev-limiter pops, tire screech, kerb rumble, and pit radio alerts.

2. **Physically Grounded Vehicle Dynamics Engine**:
   - 1.6L V6 Turbocharged Hybrid powertrain with broad torque plateau and 8-speed seamless sequential transmission.
   - Speed-squared aerodynamic downforce ($F_{\text{down}} = \frac{1}{2}\rho C_l A v^2$) and aerodynamic drag with DRS reduction.
   - Deceleration exceeding **$-5.1\text{G}$** under heavy aerodynamic loading.
   - Pacejka-derived multi-surface tire friction model (asphalt, kerb, grass).
   - Subsystem thermodynamics: engine coolant equilibrium, brake rotor heating/cooling, and 4-wheel individual tire thermal wear degradation.

3. **Professional Pitwall Telemetry Dashboard**:
   - High-performance, non-blocking 60fps rolling Canvas charts (Speed, Dual Throttle/Brake, RPM/Gear, Thermal profile).
   - G-G Traction Circle (Lateral vs Longitudinal G-force diagram).
   - 2D Vector GPS Track Map with real-time car markers, sector boundaries, and incident flashers.
   - Official timing leaderboard with sector splits (S1, S2, S3) and interval gaps.
   - Real-time rule-based engineering diagnostic log with transparent threshold detection and actionable pitwall recommendations.

4. **Dual Ingest IoT Architecture**:
   - **Mode 1: Simulation Ingest**: High-frequency synchronous 20Hz telemetry sampling and JSON serialization.
   - **Mode 2: Hardware IoT Mode**: Real or simulated ESP32 prototype streaming MPU6050 6-axis IMU accelerations, TCRT5000 optical lap trigger pulses, and temperature data over Wi-Fi/WebSocket.
   - Explicit tags distinguishing `[PHYSICAL SENSOR]`, `[DERIVED METRIC]`, and `[SIMULATION ONLY]` parameters.

5. **Post-Race Analytics & CSV Export**:
   - Podium classifications, fastest lap, and sector breakdowns.
   - Interactive dual-lap telemetry overlay comparison chart.
   - One-click CSV export of all 20Hz samples for external analysis in Python, MATLAB, or MoTeC.
   - LocalStorage persistence across browser refreshes.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended, v24 supported)
- Modern Web Browser (Google Chrome, Microsoft Edge, Firefox, Brave)

### 1. Launch with Node.js Server (Recommended for IoT Gateway & WebSockets)
```bash
# Navigate to the project folder
cd f1-iot-telemetry-sim

# Install dependencies (only required once: express & ws)
npm install

# Start the Telemetry Server & WebSocket Gateway
npm start
# or: node server.js
```
Now open your browser and navigate to:  
👉 **`http://localhost:3000`**

### 2. Standalone Zero-Install Launch (Pure Static Browser Mode)
The application is designed to be completely functional even without Node.js installed:
- Simply double-click `public/index.html` or serve with any static web server (such as Python `python -m http.server 8000` or VS Code Live Server).
- Mode 1 Simulation Ingest and the built-in ESP32 Hardware Testbench run 100% client-side in the browser.

---

## 🎮 Driving Controls

| Key | Action |
|---|---|
| <kbd>W</kbd> or <kbd>↑</kbd> | **Accelerate** (Engine Throttle) |
| <kbd>S</kbd> or <kbd>↓</kbd> | **Brake** (Hydraulic Carbon Brakes) |
| <kbd>A</kbd> or <kbd>←</kbd> | **Steer Left** |
| <kbd>D</kbd> or <kbd>→</kbd> | **Steer Right** |
| <kbd>SPACE</kbd> | **Handbrake / Emergency Brake** |
| <kbd>C</kbd> | **Toggle Camera** (Chase Cam ⟷ Cockpit Cam) |
| <kbd>T</kbd> | **Cycle View Layout** (Split Screen ⟷ Driver View ⟷ Pitwall Dashboard) |
| <kbd>R</kbd> | **Reset Car** to Track Centerline |
| <kbd>M</kbd> | **Mute / Unmute** Engine Audio |
| <kbd>ESC</kbd> | **Pause / Resume** Simulation |

---

## 📂 Project Directory Structure

```text
f1-iot-telemetry-sim/
├── package.json                    # Project dependencies & start scripts
├── server.js                       # Node.js WebSocket & REST Telemetry Gateway
├── public/                         # Web Application Root
│   ├── index.html                  # Unified application SPA (Menu, HUD, Dashboard, Results)
│   ├── css/
│   │   ├── style.css               # Global theme, HUD, screens, and split layouts
│   │   └── dashboard.css           # MoTeC / ATLAS pitwall engineering styling
│   └── js/
│       ├── config.js               # Physics constants, circuit splines, and alert thresholds
│       ├── track.js                # Procedural 3D track, curbs, gantry, and brake boards
│       ├── car-model.js            # Procedural 3D F1 car with wings, halo, glowing discs
│       ├── physics.js              # Powertrain, 8-speed gearbox, downforce, and tire friction
│       ├── ai-driver.js            # AI opponents with collision avoidance and speed profiles
│       ├── audio.js                # Procedural Web Audio API sound synthesizer
│       ├── telemetry-engine.js     # 20Hz synchronous telemetry sampling & rule engine
│       ├── iot-bridge.js           # Mode 1 / Mode 2 IoT gateway and ESP32 testbench
│       ├── track-map.js            # 2D Vector GPS track map with live car radar
│       ├── dashboard-ui.js         # Real-time gauges, rolling canvas charts & diagnostics
│       ├── post-race.js            # Lap comparison charts, CSV export & storage
│       └── main.js                 # Game loop, countdown, cameras, and state management
├── hardware/
│   ├── esp32_telemetry_firmware.ino # Complete Arduino C++ sketch for ESP32 DevKit v1
│   ├── wiring_diagram_schematic.md  # Circuit pinout, breadboard diagrams & pullups
│   └── sample_packets.json         # Real example IoT telemetry payloads
└── docs/
    ├── PROJECT_REPORT.md           # Full engineering capstone project report
    ├── PHYSICS_MODEL.md            # Formulas, mathematical derivations & aero models
    ├── TELEMETRY_DICTIONARY.md     # Parameter definitions, units, and alert thresholds
    ├── IOT_ARCHITECTURE.md         # End-to-end IoT pipeline and latency analysis
    └── FACULTY_DEMO_SCRIPT.md      # Step-by-step viva presentation script for professors
```

---

## 🔬 Telemetry Parameter Summary

| Parameter | Unit | Ingest Category | Description |
|---|---|---|---|
| `speed_kmh` | $\text{km/h}$ | Derived / Sim | Forward velocity ($0 - 360 \text{ km/h}$) |
| `engine_rpm` | $\text{RPM}$ | Simulated | 1.6L V6 Turbo speed ($4,000 - 15,200 \text{ RPM}$) |
| `gear` | $1 - 8$ | Simulated | Sequential gearbox selection |
| `throttle_pct` | $\%$ | Sensor / Sim | Driver accelerator pedal displacement |
| `brake_pct` | $\%$ | Sensor / Sim | Hydraulic brake line pressure |
| `longitudinal_g`| $\text{G}$ | **Physical (MPU6050)** | Acceleration / Braking force (up to $-5.1\text{G}$) |
| `lateral_g` | $\text{G}$ | **Physical (MPU6050)** | Cornering centripetal force (up to $\pm 4.2\text{G}$) |
| `engine_temp_c`| $^\circ\text{C}$ | Simulated | ICE Coolant fluid temperature (Warning $>106^\circ\text{C}$) |
| `tires.xx_temp`| $^\circ\text{C}$ | Simulated | 4-Wheel individual tire temperatures |
| `brakes.xx_temp`| $^\circ\text{C}$ | Simulated | Carbon rotor temperatures (Glows at $>450^\circ\text{C}$) |
| `ir_trigger` | Bool | **Physical (TCRT5000)**| Optical finish line beam detection |

---

## 🛠️ Troubleshooting & FAQ

- **No sound?**: Browsers require a user click or keypress before playing audio. Press any key (<kbd>W</kbd>, <kbd>A</kbd>, <kbd>S</kbd>, <kbd>D</kbd>) to initialize the Web Audio engine.
- **Port 3000 already in use?**: Launch with a different port using environment variables:  
  `PORT=8080 npm start`
- **Testing ESP32 Hardware Mode without physical ESP32 board?**: Click the **"Switch Ingest Mode"** button in the top navigation bar. The built-in hardware testbench will immediately simulate an active ESP32 streaming MPU6050 accelerometer noise and optical lap triggers!
