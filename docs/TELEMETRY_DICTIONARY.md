# Motorsport Telemetry Dictionary & Alert Rule Specifications

## 1. Comprehensive Telemetry Parameters Dictionary

All telemetry is sampled at **20 Hz synchronous frequency** (50 ms frame duration).

| Parameter Field | JSON Key | Physical Unit | Range | Ingest Category | Description |
|---|---|---|---|---|---|
| **Timestamp** | `timestamp_ms` | Milliseconds | Unix ms | Physical / System | Master clock reference for time-series correlation |
| **Speed** | `speed_kmh` | $\text{km/h}$ | $0.0 - 365.0$ | Derived / Simulated | Forward linear velocity |
| **Engine RPM** | `engine_rpm` | $\text{RPM}$ | $4,000 - 15,200$ | Simulated (ECU) | Crankshaft rotational speed |
| **Gear** | `gear` | Integer | $0 - 8$ | Simulated (ECU) | Transmission gear position ($0 = \text{Neutral}$) |
| **Throttle** | `throttle_pct` | $\%$ | $0 - 100$ | Physical Pot / Sim | Accelerator pedal position sensor |
| **Brake Pressure** | `brake_pct` | $\%$ | $0 - 100$ | Hydraulic Trans / Sim | Master cylinder hydraulic line pressure |
| **Steering Angle** | `steering_angle_deg`| Degrees ($^\circ$) | $-22.0^\circ \text{ to } +22.0^\circ$ | Physical Rotary / Sim | Front steering rack displacement angle |
| **Longitudinal G** | `longitudinal_g` | $\text{G} \ (\times 9.81 \text{ m/s}^2)$ | $-5.5\text{G} \text{ to } +2.2\text{G}$ | **Physical (MPU6050)** | Acceleration ($+$) and braking deceleration ($-$) |
| **Lateral G** | `lateral_g` | $\text{G} \ (\times 9.81 \text{ m/s}^2)$ | $-4.8\text{G} \text{ to } +4.8\text{G}$ | **Physical (MPU6050)** | Centripetal cornering force ($+$ Right, $-$ Left) |
| **Gyro Yaw Rate** | `gyro_z_dps` | $\text{deg/s}$ | $-120 \text{ to } +120$ | **Physical (MPU6050)** | Angular yaw velocity about vertical axis |
| **Wheel Slip** | `wheel_slip_pct` | $\%$ | $0.0 - 100.0\%$ | Derived ($v_w \text{ vs } v$) | Longitudinal wheelspin or braking lockup |
| **DRS Flap** | `drs_status` | String | `"OPEN"` / `"CLOSED"` | Simulated Actuator | Drag Reduction System flap status |
| **ERS Battery** | `ers_soc_pct` | $\%$ | $0.0 - 100.0\%$ | Simulated BMS | Hybrid Energy Recovery System battery charge |
| **Fuel Mass** | `fuel_remaining_kg`| $\text{kg}$ | $0.0 - 110.0$ | Simulated (Fuel Flow) | Onboard remaining fuel mass |
| **Engine Temp** | `engine_temp_c` | $^\circ\text{C}$ | $60.0 - 130.0$ | Simulated Radiator | Internal combustion engine coolant fluid temp |
| **Chassis Temp** | `temperature_c` | $^\circ\text{C}$ | $20.0 - 65.0$ | **Physical (DS18B20)** | Ambient or telematics enclosure temperature |
| **Tire Temp FL** | `tires.fl_temp_c`| $^\circ\text{C}$ | $60.0 - 135.0$ | Simulated (IR Pyro) | Front-Left tire carcass/bulk temperature |
| **Tire Temp FR** | `tires.fr_temp_c`| $^\circ\text{C}$ | $60.0 - 135.0$ | Simulated (IR Pyro) | Front-Right tire carcass/bulk temperature |
| **Tire Temp RL** | `tires.rl_temp_c`| $^\circ\text{C}$ | $60.0 - 135.0$ | Simulated (IR Pyro) | Rear-Left tire carcass/bulk temperature |
| **Tire Temp RR** | `tires.rr_temp_c`| $^\circ\text{C}$ | $60.0 - 135.0$ | Simulated (IR Pyro) | Rear-Right tire carcass/bulk temperature |
| **Tire Wear** | `tires.avg_wear_pct`| $\%$ | $0.0 - 100.0\%$ | Simulated Model | Tread rubber wear degradation |
| **Brake Disc FL**| `brakes.fl_temp_c`| $^\circ\text{C}$ | $200 - 1,150$ | Simulated Pyrometer | Front-Left carbon-carbon rotor temp |
| **Brake Disc FR**| `brakes.fr_temp_c`| $^\circ\text{C}$ | $200 - 1,150$ | Simulated Pyrometer | Front-Right carbon-carbon rotor temp |
| **Lap Number** | `lap_number` | Count | $1 - N$ | Ingest Transponder | Active lap number |
| **Lap Time** | `lap_time_s` | Seconds | $0.000 - 180.000$ | Derived / Physical IR | Elapsed lap time timer |
| **Lap Delta** | `delta_s` | Seconds ($\pm$) | $-9.999 \text{ to } +9.999$ | Derived vs Reference | Time difference vs personal best reference lap |
| **Sector** | `current_sector` | Integer | $1, 2, 3$ | GPS / Spline Split | Current track sector position |
| **Track Distance**| `track_distance_m`| Meters | $0 - 2,350$ | Derived GPS | Distance traveled along spline centerline |
| **IR Lap Gate** | `ir_trigger` | Boolean | `true` / `false` | **Physical (TCRT5000)**| Optical pulse upon crossing finish line strip |
| **Vehicle Status**| `status` | Enum | `NORMAL, WARN, CRIT` | Diagnostic Rule Engine| Subsystem health state |

---

## 2. Rule-Based Engineering Thresholds & Alert Matrix

| Diagnostic Subsystem | Rule Condition | Severity | Log Message & Diagnostic Root Cause | Recommended Pitwall Engineering Action |
|---|---|---|---|---|
| **Powertrain Thermal** | $T_{\text{ice}} \ge 114.0^\circ\text{C}$ | `CRITICAL` | `CRITICAL: Engine overheating (>114°C)! Blown head gasket risk.` | Mandatory lift-and-coast before Turns 1 & 5. Pull out of dirty wake. |
| **Powertrain Thermal** | $T_{\text{ice}} \ge 106.0^\circ\text{C}$ | `WARNING` | `Elevated ICE coolant temperature. High thermal strain.` | Short-shift at 13,000 RPM on main straight to lower heat flux. |
| **Tire Degradation** | $T_{\text{tire}} \ge 112.0^\circ\text{C}$ | `WARNING` | `Tire blistering / thermal graining detected (>112°C). Grip loss ~20%.` | Reduce entry speed at high-speed Esses (Turn 3/4). Avoid aggressive curbs. |
| **Tire Operating Window** | $T_{\text{tire}} < 75.0^\circ\text{C}$ | `INFO` | `Tires below operating window (<75°C). Reduced braking grip.` | Weave on out-lap and brake hard to build tire carcass pressure and temperature. |
| **Brake Rotors** | $T_{\text{rotor}} \ge 980.0^\circ\text{C}$ | `CRITICAL` | `CRITICAL: Brake fluid boiling & rotor glazing hazard (>980°C)!` | Move brake bias $2\%$ rearward; extend braking distance by $15\text{m}$. |
| **Brake Rotors** | $T_{\text{rotor}} \ge 820.0^\circ\text{C}$ | `WARNING` | `Brake disc temperature spike (>820°C). Accelerated rotor wear.` | Increase brake duct cooling opening in next pit window. |
| **Traction Control** | $\text{Slip} > 24.0\%$ | `INFO` | `Excessive longitudinal wheel spin on corner exit.` | Progressive throttle modulation on corner exit; avoid curb wheelspin. |
| **Aerodynamics** | $G_{\text{lat}} > 4.2\text{G}$ | `INFO` | `Sustained high lateral loading (>4.2G) in high-speed curve.` | Subsystems nominal. High ground-effect downforce confirmed. |
| **Track Limits** | $\text{Offset} > \frac{W}{2} + 1.2\text{m}$ | `WARNING` | `Track Limits Exceeded in Sector N. Grip reduction active.` | Car exceeded circuit bounds; grass friction coefficient active ($\mu = 0.55$). |
