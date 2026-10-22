/**
 * ============================================================================
 * HIGH-REALISM EUROPEAN GRAND PRIX CIRCUIT (GRAND PRIX FIDELITY)
 * Parkland / Woodland circuit inspired by Monza, Spa, and Silverstone
 * ============================================================================
 * Features (matching user reference Images 1, 2, and 3):
 *  - 100% removed sci-fi city skyscrapers
 *  - Dense natural forest & parkland perimeter with 300+ lush 3D trees & rolling hills
 *  - Pit straight complex:
 *      * Left side: Massive covered grandstand with steel trusses & canopy roof (Image 1)
 *      * Right side: 3-story concrete pit building with team garages & VIP suites (Image 1)
 *      * Yellow painted pit lane exit merge line on tarmac (Image 1)
 *      * Pit wall with team pit perches & debris fence
 *  - Realistic trackside barriers with authentic sponsor boards:
 *      * "ARALDICA" cyan/blue sponsor boards (Image 3)
 *      * "PIRELLI" red/yellow, "ROLEX" green/gold, "ARAMCO"
 *      * FIA steel catch fencing with chainlink mesh
 *  - Authentic red-and-white sawtooth kerbs & dusty blue runoff bands (Images 2 & 3)
 *  - Overhead sponsor truss bridge ("VAMMAV") spanning main straight (Image 1)
 *  - Realistic dark asphalt aggregate with rubber racing line & skid marks
 *  - Vast natural terrain (2400m x 2400m) with green parkland turf and gravel traps
 * ============================================================================
 */

class CircuitTrack {
  constructor(scene) {
    this.scene = scene;
    this.config = window.F1_CONFIG.CIRCUIT;
    this.points = [];
    this.curve = null;
    this.trackMesh = null;
    this.trackLength = 0;
    this.sampleCount = 700;
    this.samples = [];

    this.startGantryLights = [];
    this.drsSigns = [];

    this.initCurve();
    this.buildVastParklandLandscape();
    this.buildTrack();
    this.buildWhiteTrackLimits();
    this.buildYellowPitExitLine();
    this.buildBlueAndRedRunoffs();
    this.buildSawtoothKerbs();
    this.buildRealisticBarriersWithSponsors();
    this.buildFIAFencing();
    this.buildPitStraightArchitecture();
    this.buildDensePerimeterForest();
    this.buildOverheadBridges();
    this.buildPitLaneAndGantry();
    this.buildTracksideSignage();
  }

  initCurve() {
    this.points = this.config.nodes.map(n => new THREE.Vector3(n.x, n.y, n.z));
    this.curve = new THREE.CatmullRomCurve3(this.points, true, 'centripetal');
    this.trackLength = this.curve.getLength();

    this.samples = [];
    for (let i = 0; i <= this.sampleCount; i++) {
      const u = i / this.sampleCount;
      const point = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      this.samples.push({
        u: u,
        distance: u * this.trackLength,
        point: point,
        tangent: tangent,
        normal: normal
      });
    }
  }

  // 1. Vast Natural Parkland & Grass Landscape (2400m x 2400m)
  buildVastParklandLandscape() {
    const terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = 512;
    terrainCanvas.height = 512;
    const ctx = terrainCanvas.getContext('2d');

    // Natural muted European meadow green
    ctx.fillStyle = '#293826';
    ctx.fillRect(0, 0, 512, 512);

    // Natural soil & grass texture noise
    for (let i = 0; i < 20000; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      const g = Math.floor(Math.random() * 25 + 40);
      ctx.fillStyle = `rgb(${g - 14}, ${g + 16}, ${g - 12})`;
      ctx.fillRect(gx, gy, 3, 3);
    }

    // Sand/gravel runoff beds
    ctx.fillStyle = 'rgba(110, 95, 75, 0.28)';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 35 + Math.random() * 55, 0, Math.PI * 2);
      ctx.fill();
    }

    const groundTex = new THREE.CanvasTexture(terrainCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(36, 36);

    const groundGeo = new THREE.PlaneGeometry(2600, 2600);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.95,
      metalness: 0.05
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(-150, -0.05, 50);
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Distant rolling green hills around the horizon
    this.buildRollingHills();
  }

  // Distant green tree-covered hills on horizon (Monza / Spa style)
  buildRollingHills() {
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x1f2e1d,
      roughness: 0.98,
      metalness: 0.02
    });

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = 1600 + Math.sin(i * 3.5) * 160;
      const hillGeo = new THREE.SphereGeometry(140 + Math.sin(i * 2.1) * 45, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      hillGeo.scale(1.8, 0.45, 1.6);
      const hill = new THREE.Mesh(hillGeo, hillMat);
      hill.position.set(-200 + Math.cos(angle) * dist, -5, 60 + Math.sin(angle) * dist);
      this.scene.add(hill);
    }
  }

  // 2. High-Realism Asphalt Track Surface
  buildTrack() {
    const width = this.config.width_m;
    const segments = 550;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const leftPt = pt.clone().add(normal.clone().multiplyScalar(-width / 2));
      const rightPt = pt.clone().add(normal.clone().multiplyScalar(width / 2));

      positions.push(leftPt.x, leftPt.y + 0.05, leftPt.z);
      positions.push(rightPt.x, rightPt.y + 0.05, rightPt.z);

      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      uvs.push(0, u * 80);
      uvs.push(1, u * 80);

      if (i < segments) {
        const v1 = i * 2;
        const v2 = i * 2 + 1;
        const v3 = (i + 1) * 2;
        const v4 = (i + 1) * 2 + 1;

        indices.push(v1, v2, v3);
        indices.push(v2, v4, v3);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // Procedural PBR Racing Asphalt Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base matte asphalt gray
    ctx.fillStyle = '#1c1f24';
    ctx.fillRect(0, 0, 512, 512);

    // Weathered dark rubber groove
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#282b32');
    grad.addColorStop(0.25, '#16181c');
    grad.addColorStop(0.55, '#131518'); // Dark racing line
    grad.addColorStop(0.80, '#1d2025');
    grad.addColorStop(1, '#282b32');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt aggregate speckle
    for (let p = 0; p < 18000; p++) {
      const nx = Math.random() * 512;
      const ny = Math.random() * 512;
      const b = Math.floor(Math.random() * 40 + 20);
      ctx.fillStyle = `rgb(${b},${b},${b})`;
      ctx.fillRect(nx, ny, 2, 2);
    }

    // Braking zone rubber skid marks
    ctx.fillStyle = 'rgba(8, 8, 8, 0.40)';
    for (let s = 0; s < 10; s++) {
      const sx = 140 + Math.random() * 240;
      const sy = Math.random() * 400;
      ctx.fillRect(sx, sy, 14, 110);
    }

    const trackTexture = new THREE.CanvasTexture(canvas);
    trackTexture.wrapS = THREE.RepeatWrapping;
    trackTexture.wrapT = THREE.RepeatWrapping;

    const material = new THREE.MeshStandardMaterial({
      map: trackTexture,
      roughness: 0.82,
      metalness: 0.12
    });

    this.trackMesh = new THREE.Mesh(geometry, material);
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    this.buildStartFinishLine();
  }

  // 3. Crisp 3D White Track Limit Boundary Lines
  buildWhiteTrackLimits() {
    const halfWidth = this.config.width_m / 2;
    const lineWidth = 0.24;
    const segments = 550;

    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x222222
    });

    [-1, 1].forEach(sign => {
      const geo = new THREE.BufferGeometry();
      const pos = [];
      const norm = [];
      const idx = [];

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const pt = this.curve.getPointAt(u);
        const tangent = this.curve.getTangentAt(u);
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const pInner = pt.clone().add(normal.clone().multiplyScalar(sign * (halfWidth - lineWidth)));
        const pOuter = pt.clone().add(normal.clone().multiplyScalar(sign * halfWidth));

        pos.push(pInner.x, pInner.y + 0.055, pInner.z);
        pos.push(pOuter.x, pOuter.y + 0.055, pOuter.z);

        norm.push(0, 1, 0);
        norm.push(0, 1, 0);

        if (i < segments) {
          const v1 = i * 2;
          const v2 = i * 2 + 1;
          const v3 = (i + 1) * 2;
          const v4 = (i + 1) * 2 + 1;
          idx.push(v1, v2, v3);
          idx.push(v2, v4, v3);
        }
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setIndex(idx);

      const lineMesh = new THREE.Mesh(geo, lineMat);
      lineMesh.receiveShadow = true;
      this.scene.add(lineMesh);
    });
  }

  // 4. Yellow Pit Exit Merge Line (Prominent on left side in Image 1!)
  buildYellowPitExitLine() {
    const halfWidth = this.config.width_m / 2;
    const lineWidth = 0.35;
    const startU = 0.96;
    const endU = 0.14; // Extends along start/finish straight through Turn 1
    const segments = 120;

    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15, // Bright FIA pit exit yellow
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x443300
    });

    const geo = new THREE.BufferGeometry();
    const pos = [];
    const norm = [];
    const idx = [];

    for (let i = 0; i <= segments; i++) {
      const u = (startU + (i / segments) * (1.0 - startU + endU)) % 1.0;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // On the left side of track
      const pInner = pt.clone().add(normal.clone().multiplyScalar(-halfWidth + 0.8));
      const pOuter = pt.clone().add(normal.clone().multiplyScalar(-halfWidth + 0.8 + lineWidth));

      pos.push(pInner.x, pInner.y + 0.058, pInner.z);
      pos.push(pOuter.x, pOuter.y + 0.058, pOuter.z);

      norm.push(0, 1, 0);
      norm.push(0, 1, 0);

      if (i < segments) {
        const v1 = i * 2;
        const v2 = i * 2 + 1;
        const v3 = (i + 1) * 2;
        const v4 = (i + 1) * 2 + 1;
        idx.push(v1, v2, v3);
        idx.push(v2, v4, v3);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setIndex(idx);

    const yellowLine = new THREE.Mesh(geo, yellowMat);
    this.scene.add(yellowLine);
  }

  // 5. Authentic Sawtooth Red-and-White Kerbs (Images 2 & 3)
  buildSawtoothKerbs() {
    const kerbZones = [
      { start: 0.08, end: 0.16, side: 'both' },  // Turn 1 & 2 Chicane
      { start: 0.22, end: 0.35, side: 'both' },  // High speed Esses
      { start: 0.68, end: 0.78, side: 'both' },  // Turn 5 Hairpin
      { start: 0.88, end: 0.96, side: 'both' }   // Turn 6 & 7 Final Chicane
    ];

    // Procedural sawtooth texture (Image 3)
    const kerbCanvas = document.createElement('canvas');
    kerbCanvas.width = 128;
    kerbCanvas.height = 128;
    const ctx = kerbCanvas.getContext('2d');

    ctx.fillStyle = '#dc2626'; // Red
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#f3f4f6'; // White
    ctx.fillRect(0, 64, 128, 64);

    // Sawtooth tooth markings along inner edge
    ctx.fillStyle = '#111827';
    for (let t = 0; t < 128; t += 16) {
      ctx.fillRect(t, 60, 8, 8);
    }

    const kerbTex = new THREE.CanvasTexture(kerbCanvas);
    kerbTex.wrapS = THREE.RepeatWrapping;
    kerbTex.wrapT = THREE.RepeatWrapping;
    kerbTex.repeat.set(1, 28);

    const kerbMat = new THREE.MeshStandardMaterial({
      map: kerbTex,
      roughness: 0.68,
      metalness: 0.1
    });

    const kerbWidth = 1.45;
    const halfWidth = this.config.width_m / 2;

    kerbZones.forEach(zone => {
      const segs = 65;
      ['left', 'right'].forEach(side => {
        if (zone.side !== 'both' && zone.side !== side) return;

        const geom = new THREE.BufferGeometry();
        const pos = [];
        const norm = [];
        const uvs = [];
        const idx = [];

        for (let j = 0; j <= segs; j++) {
          const u = zone.start + (j / segs) * (zone.end - zone.start);
          const pt = this.curve.getPointAt(u);
          const tangent = this.curve.getTangentAt(u);
          const up = new THREE.Vector3(0, 1, 0);
          const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

          const sign = side === 'left' ? -1 : 1;
          const innerPt = pt.clone().add(normal.clone().multiplyScalar(sign * halfWidth));
          const outerPt = pt.clone().add(normal.clone().multiplyScalar(sign * (halfWidth + kerbWidth)));

          pos.push(innerPt.x, innerPt.y + 0.08, innerPt.z);
          pos.push(outerPt.x, outerPt.y + 0.18, outerPt.z);

          norm.push(0, 1, 0);
          norm.push(0, 1, 0);

          uvs.push(0, j * 0.95);
          uvs.push(1, j * 0.95);

          if (j < segs) {
            const v1 = j * 2;
            const v2 = j * 2 + 1;
            const v3 = (j + 1) * 2;
            const v4 = (j + 1) * 2 + 1;
            idx.push(v1, v2, v3);
            idx.push(v2, v4, v3);
          }
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(idx);

        const kerbMesh = new THREE.Mesh(geom, kerbMat);
        kerbMesh.receiveShadow = true;
        this.scene.add(kerbMesh);
      });
    });
  }

  // 6. Dusty Blue & Red Runoff Bands (Images 2 & 3)
  buildBlueAndRedRunoffs() {
    const halfWidth = this.config.width_m / 2;
    const blueWidth = 4.8;
    const redWidth = 3.2;
    const segments = 450;

    // Weathered motorsport blue runoff material (matches Image 2 & 3)
    const blueCanvas = document.createElement('canvas');
    blueCanvas.width = 128;
    blueCanvas.height = 128;
    const bCtx = blueCanvas.getContext('2d');
    bCtx.fillStyle = '#3a647c'; // Dusty FIA blue
    bCtx.fillRect(0, 0, 128, 128);
    bCtx.fillStyle = '#2c4f64';
    bCtx.fillRect(0, 0, 128, 24);
    bCtx.fillRect(0, 64, 128, 24);

    const blueTex = new THREE.CanvasTexture(blueCanvas);
    blueTex.wrapS = THREE.RepeatWrapping;
    blueTex.wrapT = THREE.RepeatWrapping;
    blueTex.repeat.set(1, 70);

    const blueMat = new THREE.MeshStandardMaterial({
      map: blueTex,
      roughness: 0.82,
      metalness: 0.10
    });

    // Outer Red Striping
    const redCanvas = document.createElement('canvas');
    redCanvas.width = 128;
    redCanvas.height = 128;
    const rCtx = redCanvas.getContext('2d');
    rCtx.fillStyle = '#992d2d'; // Weathered brick red
    rCtx.fillRect(0, 0, 128, 128);
    rCtx.fillStyle = '#ffffff';
    rCtx.fillRect(0, 32, 128, 16);
    rCtx.fillRect(0, 96, 128, 16);

    const redTex = new THREE.CanvasTexture(redCanvas);
    redTex.wrapS = THREE.RepeatWrapping;
    redTex.wrapT = THREE.RepeatWrapping;
    redTex.repeat.set(1, 50);

    const redMat = new THREE.MeshStandardMaterial({
      map: redTex,
      roughness: 0.85,
      metalness: 0.10
    });

    ['left', 'right'].forEach(side => {
      const sign = side === 'left' ? -1 : 1;

      // Blue Runoff
      const blueGeo = new THREE.BufferGeometry();
      const bPos = [];
      const bNorm = [];
      const bUvs = [];
      const bIdx = [];

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const pt = this.curve.getPointAt(u);
        const tangent = this.curve.getTangentAt(u);
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const pInner = pt.clone().add(normal.clone().multiplyScalar(sign * halfWidth));
        const pOuter = pt.clone().add(normal.clone().multiplyScalar(sign * (halfWidth + blueWidth)));

        bPos.push(pInner.x, pInner.y + 0.04, pInner.z);
        bPos.push(pOuter.x, pOuter.y + 0.04, pOuter.z);

        bNorm.push(0, 1, 0);
        bNorm.push(0, 1, 0);

        bUvs.push(0, u * 70);
        bUvs.push(1, u * 70);

        if (i < segments) {
          const v1 = i * 2;
          const v2 = i * 2 + 1;
          const v3 = (i + 1) * 2;
          const v4 = (i + 1) * 2 + 1;
          bIdx.push(v1, v2, v3);
          bIdx.push(v2, v4, v3);
        }
      }

      blueGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
      blueGeo.setAttribute('normal', new THREE.Float32BufferAttribute(bNorm, 3));
      blueGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
      blueGeo.setIndex(bIdx);

      const blueMesh = new THREE.Mesh(blueGeo, blueMat);
      blueMesh.receiveShadow = true;
      this.scene.add(blueMesh);

      // Red Runoff
      const redGeo = new THREE.BufferGeometry();
      const rPos = [];
      const rNorm = [];
      const rUvs = [];
      const rIdx = [];

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const pt = this.curve.getPointAt(u);
        const tangent = this.curve.getTangentAt(u);
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const pInner = pt.clone().add(normal.clone().multiplyScalar(sign * (halfWidth + blueWidth)));
        const pOuter = pt.clone().add(normal.clone().multiplyScalar(sign * (halfWidth + blueWidth + redWidth)));

        rPos.push(pInner.x, pInner.y + 0.035, pInner.z);
        rPos.push(pOuter.x, pOuter.y + 0.035, pOuter.z);

        rNorm.push(0, 1, 0);
        rNorm.push(0, 1, 0);

        rUvs.push(0, u * 50);
        rUvs.push(1, u * 50);

        if (i < segments) {
          const v1 = i * 2;
          const v2 = i * 2 + 1;
          const v3 = (i + 1) * 2;
          const v4 = (i + 1) * 2 + 1;
          rIdx.push(v1, v2, v3);
          rIdx.push(v2, v4, v3);
        }
      }

      redGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
      redGeo.setAttribute('normal', new THREE.Float32BufferAttribute(rNorm, 3));
      redGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
      redGeo.setIndex(rIdx);

      const redMesh = new THREE.Mesh(redGeo, redMat);
      redMesh.receiveShadow = true;
      this.scene.add(redMesh);
    });
  }

  // 7. Continuous Barriers with "ARALDICA" Sponsor Banners (Prominent in Image 3!)
  buildRealisticBarriersWithSponsors() {
    const barrierOffset = (this.config.width_m / 2) + 9.2;
    const barrierHeight = 1.15;
    const segments = 450;

    // "ARALDICA" Sponsor Banner Texture (exact match for Image 3!)
    const araldicaCanvas = document.createElement('canvas');
    araldicaCanvas.width = 512;
    araldicaCanvas.height = 64;
    const aCtx = araldicaCanvas.getContext('2d');
    aCtx.fillStyle = '#0097a7'; // Signature cyan-teal background
    aCtx.fillRect(0, 0, 512, 64);
    aCtx.fillStyle = '#ffffff';
    aCtx.font = 'bold 36px Arial Black, sans-serif';
    aCtx.textAlign = 'center';
    aCtx.textBaseline = 'middle';
    aCtx.letterSpacing = '4px';
    aCtx.fillText('ARALDICA', 128, 32);
    aCtx.fillText('ARALDICA', 384, 32);
    // Subtle white border line top and bottom
    aCtx.fillStyle = '#ffffff';
    aCtx.fillRect(0, 0, 512, 3);
    aCtx.fillRect(0, 61, 512, 3);

    const sponsorTex = new THREE.CanvasTexture(araldicaCanvas);
    sponsorTex.wrapS = THREE.RepeatWrapping;
    sponsorTex.wrapT = THREE.RepeatWrapping;
    sponsorTex.repeat.set(24, 1);

    const barrierMat = new THREE.MeshStandardMaterial({
      map: sponsorTex,
      roughness: 0.75,
      metalness: 0.15
    });

    [-1, 1].forEach(sign => {
      const geo = new THREE.BufferGeometry();
      const pos = [];
      const norm = [];
      const uvs = [];
      const idx = [];

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const pt = this.curve.getPointAt(u);
        const tangent = this.curve.getTangentAt(u);
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const basePt = pt.clone().add(normal.clone().multiplyScalar(sign * barrierOffset));
        const topPt = basePt.clone().add(new THREE.Vector3(0, barrierHeight, 0));

        pos.push(basePt.x, basePt.y, basePt.z);
        pos.push(topPt.x, topPt.y, topPt.z);

        norm.push(-normal.x * sign, 0, -normal.z * sign);
        norm.push(-normal.x * sign, 0, -normal.z * sign);

        uvs.push(u * 24, 0);
        uvs.push(u * 24, 1);

        if (i < segments) {
          const v1 = i * 2;
          const v2 = i * 2 + 1;
          const v3 = (i + 1) * 2;
          const v4 = (i + 1) * 2 + 1;
          idx.push(v1, v2, v3);
          idx.push(v2, v4, v3);
        }
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);

      const barrierMesh = new THREE.Mesh(geo, barrierMat);
      barrierMesh.castShadow = true;
      barrierMesh.receiveShadow = true;
      this.scene.add(barrierMesh);
    });
  }

  // 8. Steel FIA Catch Fencing with Wire Mesh
  buildFIAFencing() {
    const fenceOffset = (this.config.width_m / 2) + 9.3;
    const postCount = 120;
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.9, roughness: 0.2 });

    const meshCanvas = document.createElement('canvas');
    meshCanvas.width = 64;
    meshCanvas.height = 64;
    const mCtx = meshCanvas.getContext('2d');
    mCtx.clearRect(0, 0, 64, 64);
    mCtx.strokeStyle = 'rgba(210, 220, 235, 0.50)';
    mCtx.lineWidth = 1.5;
    mCtx.beginPath();
    mCtx.moveTo(0, 0); mCtx.lineTo(64, 64);
    mCtx.moveTo(64, 0); mCtx.lineTo(0, 64);
    mCtx.stroke();

    const meshTex = new THREE.CanvasTexture(meshCanvas);
    meshTex.wrapS = THREE.RepeatWrapping;
    meshTex.wrapT = THREE.RepeatWrapping;
    meshTex.repeat.set(30, 4);

    const fenceMat = new THREE.MeshStandardMaterial({
      map: meshTex,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    [-1, 1].forEach(sign => {
      for (let i = 0; i < postCount; i++) {
        const u = i / postCount;
        const pt = this.curve.getPointAt(u);
        const tangent = this.curve.getTangentAt(u);
        const up = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const postPos = pt.clone().add(normal.clone().multiplyScalar(sign * fenceOffset));
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(postPos.x, postPos.y + 2.75, postPos.z);
        post.castShadow = true;
        this.scene.add(post);

        const nextU = ((i + 1) / postCount) % 1.0;
        const nextPt = this.curve.getPointAt(nextU);
        const nextTan = this.curve.getTangentAt(nextU);
        const nextNorm = new THREE.Vector3().crossVectors(nextTan, up).normalize();
        const nextPostPos = nextPt.clone().add(nextNorm.clone().multiplyScalar(sign * fenceOffset));

        const dist = postPos.distanceTo(nextPostPos);
        const panelGeo = new THREE.PlaneGeometry(dist, 2.8);
        const panel = new THREE.Mesh(panelGeo, fenceMat);

        const mid = postPos.clone().add(nextPostPos).multiplyScalar(0.5);
        panel.position.set(mid.x, mid.y + 2.6, mid.z);
        panel.rotation.y = Math.atan2(nextPostPos.x - postPos.x, nextPostPos.z - postPos.z);
        this.scene.add(panel);
      }
    });
  }

  // 9. Main Pit Straight Architecture (Formal, Polished & Perfectly Aligned to Pit Straight)
  buildPitStraightArchitecture() {
    const halfWidth = this.config.width_m / 2;
    const straightGroup = new THREE.Group();

    // The pit straight runs along the Z axis from Z = -415 to Z = 100
    // Center the grandstand and pit building at Z = -250 (parallel to the straight)
    const grandstandLength = 240.0;
    const standRows = 12;

    // =========================================================================
    // LEFT SIDE: Covered Grandstand with Cantilever Steel Roof (Image 1)
    // Placed at X < -halfWidth (completely outside the track and barrier)
    // =========================================================================
    for (let r = 0; r < standRows; r++) {
      const stepWidth = 1.8;
      const stepHeight = 0.85;
      const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, grandstandLength);
      const stepMat = new THREE.MeshStandardMaterial({ color: 0xb0b5bc, roughness: 0.8 });
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(-halfWidth - 14.0 - (r * stepWidth), (r * stepHeight) + (stepHeight / 2), 0);
      step.castShadow = true;
      straightGroup.add(step);

      // Colorful crowd seating
      const crowdGeo = new THREE.BoxGeometry(0.8, 0.35, grandstandLength - 4);
      const crowdMat = new THREE.MeshStandardMaterial({
        color: (r % 2 === 0 ? 0xcc2222 : 0x224488),
        roughness: 0.9
      });
      const crowd = new THREE.Mesh(crowdGeo, crowdMat);
      crowd.position.set(-halfWidth - 14.0 - (r * stepWidth), (r * stepHeight) + stepHeight + 0.175, 0);
      straightGroup.add(crowd);
    }

    // Modern Cantilever Canopy Roof spanning above the seats
    const roofWidth = 30.0;
    const roofGeo = new THREE.BoxGeometry(roofWidth, 0.8, grandstandLength + 10);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5, roughness: 0.4 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(-halfWidth - 25.0, 15.0, 0);
    roof.rotation.z = -0.05;
    roof.castShadow = true;
    straightGroup.add(roof);

    // Cantilever steel support trusses behind the seats
    for (let tz = -100; tz <= 100; tz += 40) {
      const trussGeo = new THREE.CylinderGeometry(0.35, 0.35, 16.0, 8);
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.9 });
      const truss = new THREE.Mesh(trussGeo, trussMat);
      truss.position.set(-halfWidth - 37.0, 8.0, tz);
      straightGroup.add(truss);
    }

    // =========================================================================
    // RIGHT SIDE: Modern 3-Story Concrete Pit Building & Team Garages (Image 1)
    // Placed at X > halfWidth (completely outside the track)
    // =========================================================================
    const pitBuildingLength = 240.0;

    // Ground Floor: Concrete Team Garages
    const garageGeo = new THREE.BoxGeometry(18.0, 4.8, pitBuildingLength);
    const garageMat = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.7 });
    const garage = new THREE.Mesh(garageGeo, garageMat);
    garage.position.set(halfWidth + 22.0, 2.4, 0);
    garage.castShadow = true;
    straightGroup.add(garage);

    // Second Floor: VIP Hospitality Suites with Tinted Glass Balconies (Image 1)
    const suitesGeo = new THREE.BoxGeometry(16.0, 4.2, pitBuildingLength - 10);
    const suitesMat = new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.4, metalness: 0.6 });
    const suites = new THREE.Mesh(suitesGeo, suitesMat);
    suites.position.set(halfWidth + 22.0, 6.9, 0);
    straightGroup.add(suites);

    // Glass Balcony Front
    const glassGeo = new THREE.PlaneGeometry(pitBuildingLength - 12, 3.4);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.1, metalness: 0.9 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.rotation.y = -Math.PI / 2;
    glass.position.set(halfWidth + 13.9, 6.9, 0);
    straightGroup.add(glass);

    // Concrete Pit Wall separating the pit lane from the track
    const pitWallGeo = new THREE.BoxGeometry(1.0, 1.1, pitBuildingLength);
    const pitWallMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.8 });
    const pitWall = new THREE.Mesh(pitWallGeo, pitWallMat);
    pitWall.position.set(halfWidth + 4.2, 0.55, 0);
    pitWall.castShadow = true;
    straightGroup.add(pitWall);

    // Team Pit Perches (Engineers timing stations on pit wall)
    for (let p = -80; p <= 80; p += 32) {
      const perch = new THREE.Group();
      const boothGeo = new THREE.BoxGeometry(2.2, 2.0, 3.4);
      const boothMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7 });
      const booth = new THREE.Mesh(boothGeo, boothMat);
      booth.position.set(halfWidth + 5.6, 1.7, p);
      perch.add(booth);

      const screenGeo = new THREE.BoxGeometry(0.8, 0.6, 1.8);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(halfWidth + 4.8, 2.3, p);
      perch.add(screen);

      straightGroup.add(perch);
    }

    // Position straightGroup along the start/finish straight centerline
    straightGroup.position.set(0, 0, -250);
    straightGroup.rotation.y = 0; // Aligned perfectly with straight (Z axis)
    this.scene.add(straightGroup);
  }

  // 10. Dense Natural Perimeter Forest (Lush Trees Lining the Circuit, Images 2 & 3)
  buildDensePerimeterForest() {
    const forestGroup = new THREE.Group();

    // High quality 3D Deciduous Tree Generator
    const createNaturalTree = (x, y, z, scale = 1.0) => {
      const tree = new THREE.Group();

      // Wood trunk
      const trunkGeo = new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, 7.5 * scale, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(0, (7.5 * scale) / 2, 0);
      trunk.castShadow = true;
      tree.add(trunk);

      // Multi-tier lush foliage canopy (natural organic greens)
      const foliageColors = [0x1e3f22, 0x274e2d, 0x1a381e, 0x2f5a34];
      const foliageMat = new THREE.MeshStandardMaterial({
        color: foliageColors[Math.floor(Math.random() * foliageColors.length)],
        roughness: 0.85,
        flatShading: true
      });

      // 3 overlapping spherical canopy clusters
      const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6 * scale, 1), foliageMat);
      canopy1.position.set(0, 7.2 * scale, 0);
      canopy1.castShadow = true;
      tree.add(canopy1);

      const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8 * scale, 1), foliageMat);
      canopy2.position.set(0.8 * scale, 9.4 * scale, 0.4 * scale);
      tree.add(canopy2);

      const canopy3 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4 * scale, 1), foliageMat);
      canopy3.position.set(-0.6 * scale, 8.8 * scale, -0.6 * scale);
      tree.add(canopy3);

      tree.position.set(x, y, z);
      return tree;
    };

    // Plant 320+ trees lining both sides of the circuit perimeter behind the catch fences
    const treeSpacing = 28;
    for (let dist = 60; dist < this.trackLength; dist += treeSpacing) {
      const u = dist / this.trackLength;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Both left and right outer tree lines
      [-1, 1].forEach(side => {
        const offset = (this.config.width_m / 2) + 18.0 + (Math.random() * 20.0);
        const treePos = pt.clone().add(normal.clone().multiplyScalar(side * offset));

        // Exclude trees around pit straight architecture (grandstand and garages)
        if (treePos.z >= -390 && treePos.z <= -110 && Math.abs(treePos.x) <= 60) {
          return;
        }

        // Verify minimum clearance from all parts of the circuit road
        let tooClose = false;
        for (let s = 0; s < this.samples.length; s += 8) {
          if (treePos.distanceTo(this.samples[s].point) < (this.config.width_m / 2 + 15.0)) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) return;

        const treeScale = 0.85 + Math.random() * 0.55; // Varied natural tree heights
        forestGroup.add(createNaturalTree(treePos.x, treePos.y, treePos.z, treeScale));

        // Background forest depth
        if (Math.random() > 0.45) {
          const depthOffset = offset + 15.0 + Math.random() * 18.0;
          const bgTreePos = pt.clone().add(normal.clone().multiplyScalar(side * depthOffset));
          if (!(bgTreePos.z >= -390 && bgTreePos.z <= -110 && Math.abs(bgTreePos.x) <= 65)) {
            forestGroup.add(createNaturalTree(bgTreePos.x, bgTreePos.y, bgTreePos.z, treeScale * 1.15));
          }
        }
      });
    }

    this.scene.add(forestGroup);
  }

  // 11. Overhead Sponsor Gantry Bridges (Matching Image 1 & 2)
  buildOverheadBridges() {
    this.createGantryBridge(0.12, "VAMMAV", "#0288d1", "#ffffff");
    this.createGantryBridge(0.65, "PIRELLI", "#e10600", "#ffd600");
  }

  createGantryBridge(u, text, bgColor, textColor) {
    const pt = this.curve.getPointAt(u);
    const tangent = this.curve.getTangentAt(u);
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const bridgeGroup = new THREE.Group();
    const spanWidth = this.config.width_m + 18.0;

    const pillarGeo = new THREE.BoxGeometry(1.4, 9.5, 1.4);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.85, roughness: 0.3 });

    [-spanWidth / 2, spanWidth / 2].forEach(x => {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(x, 4.75, 0);
      p.castShadow = true;
      bridgeGroup.add(p);
    });

    const trussGeo = new THREE.BoxGeometry(spanWidth, 2.4, 3.2);
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.8, roughness: 0.35 });
    const truss = new THREE.Mesh(trussGeo, trussMat);
    truss.position.set(0, 8.4, 0);
    truss.castShadow = true;
    bridgeGroup.add(truss);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = bgColor;
    sCtx.fillRect(0, 0, 512, 128);
    sCtx.fillStyle = textColor;
    sCtx.font = 'bold 74px Impact, Arial Black, sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.letterSpacing = '6px';
    sCtx.fillText(text, 256, 64);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signGeo = new THREE.PlaneGeometry(spanWidth * 0.82, 2.0);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });

    const frontSign = new THREE.Mesh(signGeo, signMat);
    frontSign.position.set(0, 8.4, -1.62);
    bridgeGroup.add(frontSign);

    const backSign = new THREE.Mesh(signGeo, signMat);
    backSign.position.set(0, 8.4, 1.62);
    backSign.rotation.y = Math.PI;
    bridgeGroup.add(backSign);

    bridgeGroup.position.set(pt.x, pt.y, pt.z);
    bridgeGroup.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.scene.add(bridgeGroup);
  }

  // 12. Start/Finish Line Checkerboard
  buildStartFinishLine() {
    const pt = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const sqSize = 16;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 16; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(c * sqSize, r * sqSize, sqSize, sqSize);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    const planeGeo = new THREE.PlaneGeometry(this.config.width_m, 3.8);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const sfMesh = new THREE.Mesh(planeGeo, planeMat);
    sfMesh.position.set(pt.x, pt.y + 0.06, pt.z);
    sfMesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.scene.add(sfMesh);
  }

  // 13. Start Gantry with 5 Red Lights
  buildPitLaneAndGantry() {
    const pt = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0);

    const gantryGroup = new THREE.Group();

    const pillarGeo = new THREE.CylinderGeometry(0.38, 0.38, 9.0, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.85, roughness: 0.3 });

    // Position pillars safely outside the track boundaries
    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-this.config.width_m / 2 - 3.8, 4.5, 0);
    leftPillar.castShadow = true;
    gantryGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(this.config.width_m / 2 + 5.5, 4.5, 0);
    rightPillar.castShadow = true;
    gantryGroup.add(rightPillar);

    const beamGeo = new THREE.BoxGeometry(this.config.width_m + 10.5, 1.2, 1.6);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.7, roughness: 0.4 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0.85, 8.2, 0);
    gantryGroup.add(beam);

    this.startGantryLights = [];
    for (let l = 0; l < 5; l++) {
      const lightGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16);
      lightGeo.rotateX(Math.PI / 2);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0x220000 });
      const lightMesh = new THREE.Mesh(lightGeo, lightMat);
      lightMesh.position.set(-2.4 + (l * 1.2), 8.2, -0.85);
      gantryGroup.add(lightMesh);
      this.startGantryLights.push(lightMat);
    }

    gantryGroup.rotation.y = Math.atan2(tangent.x, tangent.z);
    gantryGroup.position.set(pt.x, pt.y, pt.z);
    this.scene.add(gantryGroup);
  }

  // 14. Distance Braking Markers (150m, 100m, 50m)
  buildTracksideSignage() {
    const brakeMarkersDist = [650, 700, 750];
    const labels = ["150", "100", "50"];

    brakeMarkersDist.forEach((dist, idx) => {
      const u = dist / this.trackLength;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const boardPos = pt.clone().add(normal.clone().multiplyScalar(-this.config.width_m / 2 - 2.8));

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(5, 5, 118, 118);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 56px Arial Black, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[idx], 64, 64);

      const tex = new THREE.CanvasTexture(canvas);
      const boardGeo = new THREE.PlaneGeometry(1.6, 1.6);
      const boardMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      const boardMesh = new THREE.Mesh(boardGeo, boardMat);
      boardMesh.position.set(boardPos.x, boardPos.y + 1.2, boardPos.z);
      boardMesh.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI / 2;
      this.scene.add(boardMesh);
    });
  }

  setStartingLights(activeCount) {
    this.startGantryLights.forEach((mat, idx) => {
      if (activeCount === 6) {
        mat.color.setHex(0x002200); // Green
      } else if (idx < activeCount) {
        mat.color.setHex(0xff0000); // Red active
      } else {
        mat.color.setHex(0x220000); // Dim red off
      }
    });
  }

  // --------------------------------------------------------------------------
  // TRACK LIMITS & KINEMATIC POSITION QUERY
  // --------------------------------------------------------------------------
  getTrackProgress(position) {
    let closestDistSq = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.samples.length; i++) {
      const dSq = position.distanceToSquared(this.samples[i].point);
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestIndex = i;
      }
    }

    const sample = this.samples[closestIndex];
    const diff = position.clone().sub(sample.point);
    const lateralOffset = diff.dot(sample.normal);

    const halfWidth = this.config.width_m / 2;
    const isOffTrack = Math.abs(lateralOffset) > halfWidth;
    const isOnKerb = Math.abs(lateralOffset) > halfWidth && Math.abs(lateralOffset) <= (halfWidth + 1.45);
    const isInRunoff = Math.abs(lateralOffset) > (halfWidth + 1.45) && Math.abs(lateralOffset) <= (halfWidth + 8.8);
    const isAtBarrier = Math.abs(lateralOffset) >= (halfWidth + 9.2);

    return {
      distance: sample.distance,
      u: sample.u,
      centerPoint: sample.point,
      tangent: sample.tangent,
      normal: sample.normal,
      lateralOffset: lateralOffset,
      isOffTrack: isOffTrack,
      isOnKerb: isOnKerb,
      isInRunoff: isInRunoff,
      isAtBarrier: isAtBarrier
    };
  }

  getSector(distance) {
    for (let i = 0; i < this.config.sectors.length; i++) {
      const sec = this.config.sectors[i];
      if (distance >= sec.startDistance && distance < sec.endDistance) {
        return i + 1;
      }
    }
    return 1;
  }
}

window.CircuitTrack = CircuitTrack;
