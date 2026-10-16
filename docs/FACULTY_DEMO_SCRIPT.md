# College Faculty Demonstration & Viva Presentation Script

**Project Title:** Application of IoT in Motorsport: Real-Time Race Car Telemetry Monitoring and Performance Analysis  
**Course / Capstone:** Engineering Final Year Project / Motorsport Simulation & Telematics Demonstrator  

---

## 1. Overview & Setup (1 Minute Before Demo)

1. Open a terminal in the project directory:
   ```bash
   node server.js
   ```
2. Open a web browser (Chrome / Edge / Firefox) and navigate to:
   ```text
   http://localhost:3000
   ```
3. Ensure audio is turned on (or use the Mute toggle if in a quiet examination room).

---

## 2. Step-by-Step Presentation Walkthrough

### Step 1: Title & Engineering Objective (30 Seconds)
- **Action:** Show the Main Menu screen.
- **Talking Points:**
  > *"Good morning, respected professors. Today we present our engineering capstone project: **'Application of IoT in Motorsport: Real-Time Race Car Telemetry Monitoring and Performance Analysis.'**  
  > In Formula 1 and endurance racing, winning is no longer just about the driver's instinct—it is about high-frequency data acquisition, wireless edge computing, and real-time engineering analytics. Our project demonstrates a full-stack implementation combining a 3D Formula physics simulator with a professional pitwall telemetry dashboard and an IoT wireless gateway."*

---

### Step 2: Starting the Race & Grid Countdown (1 Minute)
- **Action:** Click **"Quick Race (3 Cars)"**.
- **What to Observe on Screen:**
  - Notice the **5 Red Lights** countdown on the overhead starting gantry.
  - The starting grid slots: Player car (Apex Racing #44 Cyan), AI 1 (Marco Rossi #16 Red), and AI 2 (Elena Rostova #81 Yellow).
  - When all 5 lights turn off, press <kbd>W</kbd> or <kbd>↑</kbd> to launch.
- **Talking Points:**
  > *"As the race starts, our physics engine simulates the 1.6L V6 turbocharged hybrid powertrain with an 8-speed sequential transmission. You can hear the procedural engine pitch synthesized directly from the crankshaft RPM, and see the steering wheel LED shift lights light up as we approach 14,000 RPM."*

---

### Step 3: Demonstrating the Split-Screen Telemetry (1.5 Minutes)
- **Action:** Keep the view in **Split-Screen** mode (or press <kbd>T</kbd> to toggle between Driver View and Pitwall Dashboard).
- **What to Point Out on the Dashboard:**
  - **Live Ingest Rate:** Notice the badge showing **20 Hz synchronous sampling** (50 ms frames).
  - **Velocity Trace & Pedal Inputs:** Press <kbd>W</kbd> (Throttle) and observe the green trace rise; press <kbd>S</kbd> (Brake) into Turn 1 chicane and observe the red brake pressure spike up to $100\%$ with deceleration reaching **$-4.2\text{G}$**.
  - **G-G Traction Circle:** Point to the bottom-left circular diagram showing lateral and longitudinal G-force scatter within the 5G friction limit.
  - **2D GPS Radar:** Show the 3 colored dots moving in real-time along the Albert GP Ring track with Sector 1, 2, and 3 color codes.
- **Talking Points:**
  > *"Every single graph and number you see here is sampled directly from the simulation physics in real-time—there are zero prerecorded numbers. Notice how aerodynamic downforce scales with $v^2$: down the main straight at $315 \text{ km/h}$, the car produces over $2,000\text{ kg}$ of vertical downforce, allowing $-4.2\text{G}$ braking deceleration without locking wheels."*

---

### Step 4: Triggering Real Simulated Engineering Faults (1.5 Minutes)
- **Action:** Drive aggressively, brake heavily, or run over the kerbs into Turn 3.
- **What to Observe in the Event Log & Recommendations:**
  - **Engine Temperature Alert:** As the engine pushes past $106^\circ\text{C}$, the Event Log records an alert:  
    `[POWERTRAIN] WARNING: Elevated ICE coolant temperature. Action: Short-shift or lift-and-coast.`
  - **Tire Thermal Degradation:** Front tires exceed $108^\circ\text{C}$ after high-speed cornering, triggering:  
    `[TIRES] WARNING: Tire blistering detected (>112°C). Grip loss ~20%.`
  - **Brake Rotor Glow:** Notice the glowing red-hot brake rotors behind the wheels in the 3D view when temperatures exceed $500^\circ\text{C}$.
- **Talking Points:**
  > *"Our system does not just display raw sensor data—it provides intelligent engineering diagnostics. Our rule-based inference engine evaluates transparent thermodynamic and dynamic limits. When coolant exceeds $106^\circ\text{C}$ or tires exceed $112^\circ\text{C}$, the system flags specific actionable instructions to the pitwall, mirroring how race engineers coach drivers during a Grand Prix."*

---

### Step 5: Completing a Lap & Post-Race Analysis (1 Minute)
- **Action:** Complete 2 laps to finish the race (or cross the finish line to complete Lap 1).
- **What to Observe on the Results Screen:**
  - **Podium Classification:** Positions, best lap, average lap, and sector splits.
  - **Dual-Lap Speed Overlay Comparison:** Select Lap 1 vs Lap 2 in the dropdowns. Point out how the speed traces overlay across track distance, revealing exactly where time was gained or lost (e.g. earlier braking into Turn 1 vs higher exit speed).
  - **CSV Export:** Click **"📥 Export CSV Telemetry"** and show the downloaded file.
- **Talking Points:**
  > *"At the end of each lap, all 20Hz samples are archived. Here in the post-race module, engineers can overlay any two laps to compare braking points and throttle application. Furthermore, with one click, we can export the entire high-frequency dataset to a standard CSV file for external analysis in Python, MATLAB, or MoTeC i2 Pro."*

---

### Step 6: Physical IoT Hardware Integration (ESP32 Mode) (1.5 Minutes)
- **Action:** Click **"Switch Ingest Mode"** in the top navigation bar to activate **"● IoT HARDWARE (ESP32)"**.
- **What to Show the Faculty:**
  - Show the **`hardware/`** folder containing:
    1. `esp32_telemetry_firmware.ino` (Arduino C++ sketch).
    2. `wiring_diagram_schematic.md` (Circuit pinout for MPU6050, TCRT5000 IR sensor, DS18B20).
    3. `sample_packets.json` (Real IoT packet payloads).
  - Point to the hardware testbench streaming real accelerometer ($a_x, a_y, a_z$) and IR lap trigger pulses with realistic sensor noise and RSSI metrics.
  - Highlight the clear distinction between `[PHYSICAL SENSOR]` data from the hardware and `[SIMULATION ONLY]` metrics.
- **Talking Points:**
  > *"Finally, we designed this platform to operate with real embedded hardware. Our ESP32 microcontroller uses an MPU6050 6-axis IMU to measure physical lateral and longitudinal accelerations, a TCRT5000 optical sensor for millisecond-accurate finish line detection, and streams JSON frames over Wi-Fi directly into our Node.js gateway. Our system explicitly tags what is a physical sensor reading versus a derived calculation or simulation proxy, fulfilling the core IoT objective of this project."*

---

## 3. Potential Faculty Viva Questions & Model Answers

**Q1: Why did you choose a 20Hz sampling rate? Is that fast enough for motorsport?**  
*Answer:* In professional motorsport, chassis and suspension telemetry typically sample between 10Hz and 100Hz, while high-frequency engine knock sensors run at 1kHz. 20Hz (50ms interval) provides an optimal balance between precision (capturing peak braking points within $2-3$ meters at $200 \text{ km/h}$) and bandwidth efficiency ($\approx 5.6 \text{ KB/s}$), preventing network congestion over Wi-Fi.

**Q2: How does downforce affect your braking physics?**  
*Answer:* Maximum braking deceleration is limited by tire friction adhesion $F_{brake\_max} = \mu \cdot F_z$. Because aerodynamic downforce $F_{down} = \frac{1}{2} \rho C_l A v^2$ adds over $2,000 \text{ kg}$ of normal load at high speed without adding inertial mass, the car can decelerate at over **$5.1\text{G}$** at $320 \text{ km/h}$. As the car slows down, downforce decays, so available grip decreases.

**Q3: How does your system detect off-track excursions?**  
*Answer:* We compute the signed lateral distance from the 3D spline centerline using vector projection. If the lateral offset exceeds $\frac{\text{Track Width}}{2} + 1.2\text{m}$, the car is flagged as off-track, friction $\mu$ drops from $1.72$ to $0.55$ (grass), and a `[STEWARD]` warning is logged in the telemetry stream.
