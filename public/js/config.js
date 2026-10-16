/**
 * ============================================================================
 * CONFIGURATION & ENGINEERING CONSTANTS
 * Formula 1 IoT Telemetry & Race Simulator
 * ============================================================================
 */

window.F1_CONFIG = {
  // Vehicle Dynamics & Powertrain Constants
  VEHICLE: {
    mass_kg: 798,              // FIA Formula 1 minimum regulation mass (car + driver)
    weightDistributionFront: 0.46, // 46% Front, 54% Rear
    wheelbase_m: 3.6,          // 3600 mm wheelbase
    trackWidth_m: 2.0,         // 2000 mm overall width
    centerOfGravityHeight_m: 0.32,
    
    // Aerodynamics (Ground Effect + Front/Rear Wing package)
    dragCoefficient_Cd: 0.78,  // Clean air drag
    dragCoefficient_DRS: 0.62, // DRS open drag reduction
    frontalArea_m2: 1.45,      // m^2
    airDensity_kg_m3: 1.225,   // Standard sea level air density
    downforceCoeff_Cl: 3.4,    // Downforce coefficient (F_down = 0.5 * rho * Cl * A * v^2)
    
    // Powertrain: 1.6L V6 Turbocharged Hybrid (ICE + MGU-K + MGU-H)
    idleRpm: 4000,
    maxRpm: 15000,
    revLimiterRpm: 15200,
    peakTorqueNm: 420,
    peakPowerHp: 1020,         // ~750 hp ICE + 160 hp MGU-K electrical boost
    
    // 8-Speed Seamless Sequential Gearbox Ratios + Final Drive
    finalDrive: 4.15,
    gearRatios: [
      0,      // Neutral
      3.20,   // 1st (0 - 105 km/h)
      2.42,   // 2nd (105 - 150 km/h)
      1.90,   // 3rd (150 - 195 km/h)
      1.54,   // 4th (195 - 235 km/h)
      1.28,   // 5th (235 - 275 km/h)
      1.08,   // 6th (275 - 310 km/h)
      0.92,   // 7th (310 - 340 km/h)
      0.80    // 8th (340 - 365+ km/h top end)
    ],
    shiftDelayMs: 65,         // Seamless shift dog-ring actuation delay

    // Braking System (Carbon-Carbon Brembo Discs & Calipers)
    maxBrakingDecel_ms2: 50.0, // Up to 5.1G under high aerodynamic load
    brakeBiasFront: 0.56,      // 56% Front / 44% Rear brake pressure bias

    // Tire Model (Pirelli P-Zero Red Soft Compound)
    tireOptimalTemp_C: 95.0,
    tireMinTemp_C: 75.0,
    tireMaxTemp_C: 115.0,
    tireGripPeakCoeff: 1.72,   // Peak friction coefficient mu on dry racing asphalt
    tireGripGrassCoeff: 0.55,  // Off-track grass friction
    tireGripKerbCoeff: 1.15,   // Kerb vibration and mild slip
    tireWearRatePerKm: 0.015,  // Wear percentage per km driven

    // Power Unit Thermal Model
    engineNormalTemp_C: 98.0,
    engineThermalMass: 180.0,
    radiatorCoolingCoeff: 0.08,
    ambientTemp_C: 27.5
  },

  // Engineering Alert Thresholds for the Race Engineer Dashboard
  THRESHOLDS: {
    ENGINE_TEMP: {
      WARNING_C: 106.0,
      CRITICAL_C: 114.0,
      MESSAGE_WARN: "Elevated ICE coolant temperature. High thermal strain.",
      MESSAGE_CRIT: "CRITICAL: Engine overheating (>114°C)! Blown head gasket risk. Lift-and-coast immediately.",
      SUBSYSTEM: "POWERTRAIN"
    },
    TIRE_TEMP: {
      COLD_C: 75.0,
      HOT_WARN_C: 112.0,
      HOT_CRIT_C: 122.0,
      MESSAGE_COLD: "Tires below operating window (<75°C). Reduced braking grip.",
      MESSAGE_HOT: "Tire blistering / thermal graining detected (>112°C). Grip loss ~20%.",
      SUBSYSTEM: "TIRES"
    },
    BRAKE_TEMP: {
      HOT_WARN_C: 820.0,
      HOT_CRIT_C: 980.0,
      MESSAGE_WARN: "Brake disc temperature spike (>820°C). Accelerated rotor wear.",
      MESSAGE_CRIT: "CRITICAL: Brake fluid boiling & rotor glazing hazard (>980°C)!",
      SUBSYSTEM: "BRAKES"
    },
    WHEEL_SLIP: {
      TRACTION_ALERT: 0.24,
      MESSAGE: "Excessive longitudinal wheel spin on corner exit. High rear tire degradation.",
      SUBSYSTEM: "DYNAMICS"
    },
    LATERAL_G: {
      HIGH_G: 4.2,
      MESSAGE: "Sustained high lateral loading (>4.2G) in high-speed curve.",
      SUBSYSTEM: "AERODYNAMICS"
    }
  },

  // Driver Rosters & Team Liveries (Full 6-Car Grid inspired by modern Grand Prix racing)
  DRIVERS: [
    {
      id: 'player',
      name: 'Carlos Vance',
      code: 'VAN',
      number: 44,
      team: 'Apex Racing GP',
      country: 'GBR',
      color: '#00e5ff',       // Electric Cyan
      accentColor: '#0a0e17', // Obsidian Carbon
      haloColor: '#00e5ff',
      gloveColor: '#00e5ff',
      isPlayer: true,
      aiProfile: {
        aggression: 0.85,
        brakingConsistency: 0.95,
        cornerSpeedFactor: 1.0,
        mistakeProbability: 0.01
      }
    },
    {
      id: 'ai_1',
      name: 'Marco Rossi',
      code: 'ROS',
      number: 16,
      team: 'Scuderia Veloce',
      country: 'ITA',
      color: '#e10600',       // Racing Scarlet Red (Ferrari inspired)
      accentColor: '#1a1a1a', // Black
      haloColor: '#1a1a1a',
      gloveColor: '#e10600',
      isPlayer: false,
      aiProfile: {
        aggression: 0.94,      // Aggressive late braker, high straight-line speed
        brakingConsistency: 0.92,
        cornerSpeedFactor: 0.995,
        mistakeProbability: 0.02
      }
    },
    {
      id: 'ai_2',
      name: 'Elena Rostova',
      code: 'ROS',
      number: 81,
      team: 'CyberGP Engineering',
      country: 'FIN',
      color: '#ffd600',       // Electric Yellow
      accentColor: '#1e1e1e', // Charcoal
      haloColor: '#ffd600',
      gloveColor: '#ffd600',
      isPlayer: false,
      aiProfile: {
        aggression: 0.80,      // Smooth, disciplined racing line
        brakingConsistency: 0.98,
        cornerSpeedFactor: 0.988,
        mistakeProbability: 0.005
      }
    },
    {
      id: 'ai_3',
      name: 'Lucas Weber',
      code: 'WEB',
      number: 5,
      team: 'Aston Grand Prix',
      country: 'GER',
      color: '#00594f',       // British Racing Green
      accentColor: '#cedc00', // Lime Accent
      haloColor: '#00594f',
      gloveColor: '#00594f',
      isPlayer: false,
      aiProfile: {
        aggression: 0.88,
        brakingConsistency: 0.94,
        cornerSpeedFactor: 0.99,
        mistakeProbability: 0.015
      }
    },
    {
      id: 'ai_4',
      name: 'Alexander Lind',
      code: 'LIN',
      number: 23,
      team: 'Silver Arrow Works',
      country: 'SWE',
      color: '#c0c0c0',       // Silver / Chrome Metallic
      accentColor: '#00a19c', // Petronas Turquoise
      haloColor: '#111111',
      gloveColor: '#00a19c',
      isPlayer: false,
      aiProfile: {
        aggression: 0.86,
        brakingConsistency: 0.96,
        cornerSpeedFactor: 0.992,
        mistakeProbability: 0.01
      }
    },
    {
      id: 'ai_5',
      name: 'Mateo Dupont',
      code: 'DUP',
      number: 10,
      team: 'Alpine Tricolore',
      country: 'FRA',
      color: '#0090ff',       // Alpine Blue
      accentColor: '#fd4bc7', // BWT Pink
      haloColor: '#0090ff',
      gloveColor: '#0090ff',
      isPlayer: false,
      aiProfile: {
        aggression: 0.84,
        brakingConsistency: 0.93,
        cornerSpeedFactor: 0.986,
        mistakeProbability: 0.02
      }
    }
  ],

  // Circuit Waypoint Spline Definition: "Albert Grand Prix Ring"
  // Closed loop track with straights, chicanes, high-speed esses, and hairpin
  CIRCUIT: {
    name: "Albert Grand Prix Engineering Ring",
    length_m: 2350,
    width_m: 14.0,
    sectors: [
      { name: "Sector 1", startDistance: 0, endDistance: 780, color: "#e10600" },     // Main Straight + T1/T2 Chicane
      { name: "Sector 2", startDistance: 780, endDistance: 1620, color: "#ffd600" },  // Sweeping Esses + Back Straight
      { name: "Sector 3", startDistance: 1620, endDistance: 2350, color: "#00e5ff" }  // Hairpin + Final Chicane
    ],
    speedTrapDistance: 620, // End of main straight speed trap
    drsZone: { startDistance: 120, endDistance: 680 },
    
    // Central Spline Points (X, Z coordinates in meters, Y is elevation)
    nodes: [
      { x: 0,    y: 0.0, z: -400, desc: "Start/Finish Line" },
      { x: 0,    y: 0.0, z: -200, desc: "DRS Zone Mid" },
      { x: 0,    y: 0.0, z: 100,  desc: "150m Brake Marker" },
      { x: 15,   y: 0.2, z: 240,  desc: "Turn 1 Chicane Entry (Right)" },
      { x: -25,  y: 0.4, z: 320,  desc: "Turn 2 Chicane Apex (Left)" },
      { x: -30,  y: 0.2, z: 420,  desc: "Turn 2 Exit Acceleration" },
      { x: -90,  y: 1.0, z: 540,  desc: "Turn 3 High-speed S-Curve" },
      { x: -180, y: 1.8, z: 580,  desc: "Turn 4 S-Curve Right" },
      { x: -280, y: 2.5, z: 520,  desc: "Turn 4 Exit to Back Straight" },
      { x: -360, y: 1.5, z: 380,  desc: "Back Straight Entry" },
      { x: -440, y: 0.5, z: 180,  desc: "Back Straight Speed Trap" },
      { x: -480, y: 0.0, z: -40,  desc: "Turn 5 Hairpin Braking Zone" },
      { x: -450, y: 0.0, z: -180, desc: "Turn 5 Hairpin Apex (Sharp Right)" },
      { x: -360, y: 0.2, z: -250, desc: "Hairpin Exit Traction Zone" },
      { x: -250, y: 0.5, z: -320, desc: "Turn 6 Fast Sweeper Left" },
      { x: -140, y: 0.2, z: -380, desc: "Turn 7 Final Chicane" },
      { x: -45,  y: 0.0, z: -430, desc: "Final Corner Pit Straight Entry" },
      { x: 0,    y: 0.0, z: -415, desc: "Straight Alignment Node" }
    ]
  },

  // IoT Hardware Schema & Mode Constants
  IOT: {
    SAMPLE_RATE_HZ: 20,           // 20 telemetry updates per second (50ms interval)
    ESP32_DEFAULT_PORT: 8080,
    WS_ENDPOINT: "/telemetry-stream",
    REST_INGEST_ENDPOINT: "/api/telemetry/ingest",
    SENSORS: {
      MPU6050: { bus: "I2C 0x68", rate: "100Hz", params: ["accel_x_g", "accel_y_g", "accel_z_g", "gyro_z_dps"] },
      TCRT5000_IR: { pin: "GPIO4 Interrupt", rate: "Edge-triggered", params: ["ir_beam_lap_trigger", "sector_beam_trigger"] },
      DS18B20: { bus: "OneWire GPIO18", rate: "2Hz", params: ["ambient_temp_c", "chassis_temp_c"] },
      HALL_EFFECT: { pin: "GPIO19/23", rate: "Pulses", params: ["wheel_speed_kmh", "engine_rpm"] }
    }
  }
};
