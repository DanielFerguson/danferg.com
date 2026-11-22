/**
 * Stylized cartoon Three.js miniature airport diorama renderer.
 *
 * Pure view layer: every frame it steps the Rust WASM ECS world, reads the
 * flat binary snapshot, and updates procedural low-poly meshes, runway mutex
 * lights, radio waves, weather particles, and projected HTML callsign pills.
 */

import * as THREE from "three";
import {
  AtcSimClient,
  type AircraftSnapshot,
  type RadioLogEntry,
  type ScenarioPresetId,
  type SimSnapshot,
} from "./wasm-bridge";

const LIVERY_COLORS = [
  0xff5d6c, // Coral red
  0x3b82f6, // Sky blue
  0xf59e0b, // Mango gold
  0x14b8a6, // Mint teal
  0x6d4aff, // Danferg signal violet
  0xfb7185, // Rose coral
];

const GATE_X = [-4.0, 2.5, 9.0, 15.5, 22.0, 28.5];

interface AircraftMeshBundle {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  shadow: THREE.Mesh;
  halo: THREE.Mesh;
  priorityRing: THREE.Mesh;
  props: THREE.Object3D[];
  strobe: THREE.Mesh;
  kind: number;
  lastPhase: number;
}

interface Puff {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface SceneOptions {
  container: HTMLElement;
  labelsLayer: HTMLElement;
  preset: ScenarioPresetId;
  showLabels?: boolean;
  showHalos?: boolean;
  showRadioWaves?: boolean;
  cameraDistance?: number;
  onSnapshot?: (snapshot: SimSnapshot, log: RadioLogEntry[]) => void;
  onSelectAircraft?: (aircraft: AircraftSnapshot | null) => void;
}

export class CartoonAirportScene {
  private opts: SceneOptions;
  private sim!: AtcSimClient;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private ambientLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private islandTopMat!: THREE.MeshStandardMaterial;
  private islandBaseMat!: THREE.MeshStandardMaterial;
  private rwyAsphaltMat!: THREE.MeshStandardMaterial;

  // Dynamic layout groups & runway mutex indicators
  private layoutGroup = new THREE.Group();
  private glideslopeGroup = new THREE.Group();
  private rwyLightStrips: [THREE.MeshStandardMaterial[], THREE.MeshStandardMaterial[], THREE.MeshStandardMaterial[]] = [
    [],
    [],
    [],
  ];
  private gateMeshes: THREE.Group[] = [];
  private radarDish!: THREE.Object3D;
  private towerBeaconMat!: THREE.MeshBasicMaterial;
  private windsockPivot!: THREE.Group;
  private holdingRingGroup!: THREE.Group;
  private cloudsGroup = new THREE.Group();
  private rainLines!: THREE.LineSegments;
  private rainPositions!: Float32Array;
  private lightningIntensity = 0;

  // Dynamic entities
  private aircraftMap = new Map<number, AircraftMeshBundle>();
  private labelElements = new Map<number, HTMLButtonElement>();
  private radioBeamLine!: THREE.Line;
  private radioRipples: THREE.Mesh[] = [];
  private selectionBeacon!: THREE.Group;
  private selectionLine!: THREE.Line;
  private puffs: Puff[] = [];

  // Runtime state
  private currentLayout = -1;
  private currentGates = -1;
  private currentWeather = -1;
  private selectedEntityId: number | null = null;
  private paused = false;
  private speedMultiplier = 1.0;
  private showLabels: boolean;
  private showHalos: boolean;
  private showRadioWaves: boolean;
  private isVisible = true;
  private destroyed = false;
  private rafId = 0;
  private lastFrameMs = 0;
  private uiThrottle = 0;

  // Orbit camera state (zoomed out to frame the entire floating island, approach & holding stack)
  private orbitAzimuth = 0.44;
  private orbitPolar = 0.84;
  private orbitDistance: number;
  private readonly defaultAzimuth = 0.44;
  private readonly defaultPolar = 0.84;
  private readonly defaultDistance: number;
  private orbitTarget = new THREE.Vector3(0.0, 1.2, -1.5);
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private pointerMoved = false;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private projVec = new THREE.Vector3();

  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private themeObserver?: MutationObserver;

  constructor(opts: SceneOptions) {
    this.opts = opts;
    this.showLabels = opts.showLabels ?? true;
    this.showHalos = opts.showHalos ?? true;
    this.showRadioWaves = opts.showRadioWaves ?? true;
    this.defaultDistance = opts.cameraDistance ?? 124;
    this.orbitDistance = this.defaultDistance;
  }

  async init(): Promise<void> {
    this.sim = await AtcSimClient.create(this.opts.preset);

    const width = Math.max(this.opts.container.clientWidth, 300);
    const height = Math.max(this.opts.container.clientHeight, 260);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(37, width / height, 1, 380);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.opts.container.appendChild(this.renderer.domElement);

    this.buildLights();
    this.buildBaseDiorama();
    this.buildControlTower();
    this.buildWindsock();
    this.buildHoldingOval();
    this.buildClouds();
    this.buildRain();
    this.buildRadioVisuals();
    this.buildSelectionBeacon();
    this.scene.add(this.layoutGroup);
    this.scene.add(this.glideslopeGroup);

    this.applyThemeColors();
    this.bindInteractions();

    // Respect prefers-reduced-motion: render initial frame cleanly, let user press Play.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      this.paused = true;
    }

    // Initial sync & render
    const initialSnap = this.sim.readSnapshot();
    this.syncFromSnapshot(initialSnap, 0.016);
    this.opts.onSnapshot?.(initialSnap, this.sim.readRadioLog());
    this.renderer.render(this.scene, this.camera);

    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  getSim(): AtcSimClient {
    return this.sim;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastFrameMs = performance.now();
  }

  setSpeed(speed: number): void {
    this.speedMultiplier = speed;
  }

  setOverlays(opts: { labels?: boolean; halos?: boolean; radioWaves?: boolean }): void {
    if (opts.labels !== undefined) {
      this.showLabels = opts.labels;
      this.opts.labelsLayer.style.display = this.showLabels ? "" : "none";
    }
    if (opts.halos !== undefined) {
      this.showHalos = opts.halos;
      this.holdingRingGroup.visible = this.showHalos;
      this.glideslopeGroup.visible = this.showHalos;
    }
    if (opts.radioWaves !== undefined) {
      this.showRadioWaves = opts.radioWaves;
    }
  }

  zoom(delta: number): void {
    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance + delta, 58, 190);
    this.updateCameraPosition();
  }

  resetCamera(): void {
    this.orbitAzimuth = this.defaultAzimuth;
    this.orbitPolar = this.defaultPolar;
    this.orbitDistance = this.defaultDistance;
    this.updateCameraPosition();
  }

  resetScenario(preset?: ScenarioPresetId): void {
    this.selectedEntityId = null;
    this.opts.onSelectAircraft?.(null);
    this.sim.reset(preset ?? this.opts.preset);
    const snap = this.sim.readSnapshot();
    this.syncFromSnapshot(snap, 0.016);
    this.opts.onSnapshot?.(snap, this.sim.readRadioLog());
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.sim?.destroy();
    this.renderer?.dispose();
    this.opts.container.innerHTML = "";
    this.opts.labelsLayer.innerHTML = "";
  }

  private buildLights(): void {
    this.ambientLight = new THREE.HemisphereLight(0xf6f8ff, 0x6b8f68, 1.15);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e5, 1.45);
    this.sunLight.position.set(42, 68, 38);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 190;
    const d = 62;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);
  }

  private buildBaseDiorama(): void {
    // Rounded island top slab (grassy airfield diorama)
    const islandShape = createRoundedRectShape(102, 74, 10);
    const topGeo = new THREE.ExtrudeGeometry(islandShape, {
      depth: 1.4,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.6,
      bevelThickness: 0.6,
    });
    topGeo.rotateX(Math.PI / 2);

    this.islandTopMat = new THREE.MeshStandardMaterial({
      color: 0x72c272,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true,
    });
    const topMesh = new THREE.Mesh(topGeo, this.islandTopMat);
    // ExtrudeGeometry with bevelThickness=0.6 extends +0.6 above local origin after rotateX(PI/2),
    // so placing the mesh at y = -0.64 puts the grass top cleanly at y = -0.04 below all tarmac!
    topMesh.position.y = -0.64;
    topMesh.receiveShadow = true;
    this.scene.add(topMesh);

    // Earthy diorama pedestal skirt underneath
    const baseShape = createRoundedRectShape(99, 71, 9);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: 4.2,
      bevelEnabled: false,
    });
    baseGeo.rotateX(Math.PI / 2);
    this.islandBaseMat = new THREE.MeshStandardMaterial({
      color: 0xc29e74,
      roughness: 0.95,
      flatShading: true,
    });
    const baseMesh = new THREE.Mesh(baseGeo, this.islandBaseMat);
    baseMesh.position.y = -2.2;
    this.scene.add(baseMesh);

    // Shared runway asphalt material (roughness drops in Rain/Storm for wet sheen!)
    this.rwyAsphaltMat = new THREE.MeshStandardMaterial({
      color: 0x2c3342,
      roughness: 0.86,
      metalness: 0.08,
    });

    // South apron tarmac behind gates
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x525c6e,
      roughness: 0.88,
    });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(44, 0.14, 11.5), apronMat);
    apron.position.set(12.2, 0.01, 21.0);
    apron.receiveShadow = true;
    this.scene.add(apron);

    // Main Terminal Building (chunky cute cartoon style)
    const terminalGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f1fb, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5b46e8, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.22,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(39, 3.6, 5.4), wallMat);
    body.position.set(12.2, 1.8, 28.4);
    body.castShadow = true;
    body.receiveShadow = true;
    terminalGroup.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(40.2, 0.65, 6.2), roofMat);
    roof.position.set(12.2, 3.9, 28.4);
    roof.castShadow = true;
    terminalGroup.add(roof);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(37.2, 1.45, 5.65), glassMat);
    glassBand.position.set(12.2, 2.0, 28.4);
    terminalGroup.add(glassBand);
    this.scene.add(terminalGroup);

    // 6 Jetbridge gates (toggled dynamically via activeGates)
    for (let i = 0; i < GATE_X.length; i++) {
      const g = new THREE.Group();
      const gx = GATE_X[i];

      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.15, 3.3),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 }),
      );
      bridge.position.set(gx, 1.3, 24.4);
      bridge.castShadow = true;
      g.add(bridge);

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.05, 4.4),
        new THREE.MeshStandardMaterial({ color: 0x3b4352, roughness: 0.9 }),
      );
      pad.position.set(gx, 0.08, 21.8);
      g.add(pad);

      // Painted yellow nose-wheel parking T
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 2.6), lineMat);
      stem.position.set(gx, 0.1, 21.8);
      g.add(stem);

      this.gateMeshes.push(g);
      this.scene.add(g);
    }

    // Perimeter low-poly stylized pine trees & bushes for toy-diorama charm!
    const treePositions: [number, number, number][] = [
      [-43, -29, 1.15],
      [-40, -25, 0.85],
      [-45, -21, 1.0],
      [-44, 24, 1.1],
      [-39, 28, 0.9],
      [-33, 29, 1.15],
      [-26, 29, 0.85],
      [36, 26, 1.1],
      [41, 22, 0.95],
      [44, 27, 1.2],
      [43, -27, 1.1],
      [38, -29, 0.9],
      [29, -30, 1.05],
      [19, -30, 0.85],
      [-2, -29, 1.0],
      [-8, -31, 0.8],
      [-34, -30, 1.1],
      [-45, 6, 0.95],
      [44, 9, 0.9],
    ];
    for (const [tx, tz, scale] of treePositions) {
      const tree = createCartoonTree(scale);
      tree.position.set(tx, 0.0, tz);
      this.scene.add(tree);
    }
  }

  private buildControlTower(): void {
    const tower = new THREE.Group();
    tower.position.set(-12.0, 0.0, 23.5);

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
      flatShading: true,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x4f39f6,
      roughness: 0.45,
      flatShading: true,
    });
    const cabGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.4,
      flatShading: true,
    });

    // Base podium
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.4, 8), concreteMat);
    base.position.y = 0.7;
    base.castShadow = true;
    tower.add(base);

    // Tapered shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 6.4, 8), concreteMat);
    shaft.position.y = 4.6;
    shaft.castShadow = true;
    tower.add(shaft);

    // Purple collar ring
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 1.7, 0.9, 8), accentMat);
    collar.position.y = 7.9;
    collar.castShadow = true;
    tower.add(collar);

    // Octagonal glass cab (slightly flared outward like a real ATC cab!)
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 2.6, 2.1, 8), cabGlassMat);
    cab.position.y = 9.35;
    cab.castShadow = true;
    tower.add(cab);

    // Roof cap
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.2, 0.55, 8), concreteMat);
    roof.position.y = 10.6;
    roof.castShadow = true;
    tower.add(roof);

    // Spinning radar dish assembly on the roof
    const radarPivot = new THREE.Group();
    radarPivot.position.y = 11.4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 6), accentMat);
    mast.position.y = -0.15;
    radarPivot.add(mast);

    const dishBar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.22), concreteMat);
    dishBar.position.y = 0.45;
    radarPivot.add(dishBar);

    const dishTip = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.26), accentMat);
    dishTip.position.y = 0.74;
    radarPivot.add(dishTip);

    this.radarDish = radarPivot;
    tower.add(radarPivot);

    // Blinking red obstruction beacon
    this.towerBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), this.towerBeaconMat);
    beacon.position.set(1.6, 11.1, 0);
    tower.add(beacon);

    this.scene.add(tower);
  }

  private buildWindsock(): void {
    const group = new THREE.Group();
    group.position.set(16.0, 0.0, -7.8);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.13, 3.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }),
    );
    pole.position.y = 1.8;
    pole.castShadow = true;
    group.add(pole);

    const pivot = new THREE.Group();
    pivot.position.set(0, 3.45, 0);

    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });

    for (let i = 0; i < 4; i++) {
      const r1 = 0.36 - i * 0.06;
      const r2 = 0.30 - i * 0.06;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(r2, r1, 0.58, 8),
        i % 2 === 0 ? orangeMat : whiteMat,
      );
      seg.rotation.z = -Math.PI / 2;
      seg.position.x = 0.35 + i * 0.56;
      pivot.add(seg);
    }

    this.windsockPivot = pivot;
    group.add(pivot);
    this.scene.add(group);
  }

  private buildHoldingOval(): void {
    this.holdingRingGroup = new THREE.Group();
    const pts: THREE.Vector3[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push(new THREE.Vector3(24.0 + Math.cos(a) * 14.5, 11.5, -20.0 + Math.sin(a) * 8.5));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: 0x8b7bff,
      dashSize: 2.2,
      gapSize: 1.6,
      transparent: true,
      opacity: 0.45,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    this.holdingRingGroup.add(line);
    this.holdingRingGroup.visible = this.showHalos;
    this.scene.add(this.holdingRingGroup);
  }

  private buildClouds(): void {
    // Soft, fluffy cartoon clouds drifting around the high sky perimeter
    const cloudConfigs: [number, number, number, number, number][] = [
      [-48, 28, -36, 1.35, 0.0],
      [-6, 31, -40, 1.55, 1.4],
      [44, 29, -32, 1.2, 2.7],
      [52, 27, 22, 1.15, 4.1],
      [-42, 29, 32, 1.25, 5.2],
    ];
    const puffGeo = new THREE.SphereGeometry(1, 16, 12);

    for (const [cx, cy, cz, scale, phase] of cloudConfigs) {
      const c = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.14,
        roughness: 0.94,
        metalness: 0.0,
        flatShading: false,
        transparent: true,
        opacity: 0.88,
      });

      // Layered fluffy silhouette with gently flattened undersides
      const puffs: [number, number, number, number, number, number][] = [
        [0.0, 0.2, 0.0, 3.0, 1.9, 2.3],
        [-2.4, -0.2, 0.3, 2.2, 1.45, 1.85],
        [2.5, -0.15, -0.2, 2.35, 1.5, 1.9],
        [-1.0, 1.0, -0.2, 2.0, 1.45, 1.75],
        [1.2, 0.85, 0.35, 1.85, 1.35, 1.65],
        [3.9, -0.45, 0.1, 1.4, 0.95, 1.25],
        [-3.8, -0.45, -0.1, 1.35, 0.9, 1.2],
      ];
      for (const [px, py, pz, sx, sy, sz] of puffs) {
        const m = new THREE.Mesh(puffGeo, mat);
        m.position.set(px, py, pz);
        m.scale.set(sx, sy, sz);
        c.add(m);
      }

      c.position.set(cx, cy, cz);
      c.scale.setScalar(scale);
      c.userData.baseY = cy;
      c.userData.phase = phase;
      c.userData.speed = 0.55 + (scale - 1.0) * 0.45;
      this.cloudsGroup.add(c);
    }
    this.scene.add(this.cloudsGroup);
  }

  private buildRadioVisuals(): void {
    // Curved dashed beam between Control Tower cab and target aircraft
    const curvePts = new Array(28).fill(0).map(() => new THREE.Vector3());
    const beamGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
    const beamMat = new THREE.LineDashedMaterial({
      color: 0x8b5cf6,
      dashSize: 1.4,
      gapSize: 1.0,
      transparent: true,
      opacity: 0.72,
    });
    this.radioBeamLine = new THREE.Line(beamGeo, beamMat);
    this.radioBeamLine.visible = false;
    this.scene.add(this.radioBeamLine);

    // Three staggered expanding signal ripples travelling along the broadcast arc
    const rippleGeo = new THREE.TorusGeometry(0.95, 0.09, 8, 24);
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(rippleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.radioRipples.push(mesh);
    }
  }

  private buildSelectionBeacon(): void {
    this.selectionBeacon = new THREE.Group();
    this.selectionBeacon.visible = false;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.85, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7c5cff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    this.selectionBeacon.add(ring);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x7c5cff,
      dashSize: 0.7,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.75,
    });
    this.selectionLine = new THREE.Line(lineGeo, lineMat);
    this.selectionBeacon.add(this.selectionLine);

    this.scene.add(this.selectionBeacon);
  }

  private buildRain(): void {
    const dropCount = 340;
    this.rainPositions = new Float32Array(dropCount * 6);
    for (let i = 0; i < dropCount; i++) {
      const x = (Math.random() - 0.5) * 110;
      const y = Math.random() * 34;
      const z = (Math.random() - 0.5) * 82;
      const idx = i * 6;
      this.rainPositions[idx] = x;
      this.rainPositions[idx + 1] = y;
      this.rainPositions[idx + 2] = z;
      this.rainPositions[idx + 3] = x - 0.6;
      this.rainPositions[idx + 4] = y - 1.9;
      this.rainPositions[idx + 5] = z + 0.25;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.rainPositions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.52,
    });
    this.rainLines = new THREE.LineSegments(geo, mat);
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  private rebuildLayoutMeshes(layout: number): void {
    this.currentLayout = layout;
    this.layoutGroup.clear();
    this.glideslopeGroup.clear();
    this.rwyLightStrips = [[], [], []];

    const taxiMat = new THREE.MeshStandardMaterial({ color: 0x4b5565, roughness: 0.88 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // Main Taxiway Alpha (z = 13)
    const mainTaxi = new THREE.Mesh(new THREE.BoxGeometry(66, 0.12, 3.0), taxiMat);
    mainTaxi.position.set(2.0, 0.03, 13.0);
    mainTaxi.receiveShadow = true;
    this.layoutGroup.add(mainTaxi);

    const taxiLine = new THREE.Mesh(new THREE.BoxGeometry(64, 0.04, 0.18), yellowMat);
    taxiLine.position.set(2.0, 0.1, 13.0);
    this.layoutGroup.add(taxiLine);

    // West exit connector from RWY 27 (x = -28, z = 0..13)
    const westExit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 13.0), taxiMat);
    westExit.position.set(-28.0, 0.03, 6.5);
    westExit.receiveShadow = true;
    this.layoutGroup.add(westExit);

    // East entry connector to RWY 27 (x = 31.5, z = 0..13)
    const eastEntry = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 13.0), taxiMat);
    eastEntry.position.set(31.5, 0.03, 6.5);
    eastEntry.receiveShadow = true;
    this.layoutGroup.add(eastEntry);

    // Always build Main Runway RWY 27 (z = 0, x = -34..+34)
    this.addRunwayMesh(0, 0.0, 0.0, 68.0, 6.6, 0, layout === 1 ? "27L" : "27");
    this.addHoldShortBar(0, 31.5, 6.8, 0);
    this.addGlideslopePath(new THREE.Vector3(62.0, 8.8, 0.0), new THREE.Vector3(28.0, 0.4, 0.0));

    if (layout === 1) {
      // Parallel Runway RWY 27R (z = -16, x = -34..+34)
      this.addRunwayMesh(1, 0.0, -16.0, 68.0, 6.6, 0, "27R");
      this.addHoldShortBar(1, 37.5, -10.0, 0);
      this.addGlideslopePath(new THREE.Vector3(62.0, 8.8, -16.0), new THREE.Vector3(28.0, 0.4, -16.0));

      // Perimeter taxiway around west end (x = -38, z = -16..13)
      const westPerim = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 30.5), taxiMat);
      westPerim.position.set(-38.0, 0.03, -1.5);
      this.layoutGroup.add(westPerim);

      const westJoin = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.12, 2.8), taxiMat);
      westJoin.position.set(-34.0, 0.03, 13.0);
      this.layoutGroup.add(westJoin);

      const westRwyJoin = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.12, 2.8), taxiMat);
      westRwyJoin.position.set(-35.5, 0.03, -16.0);
      this.layoutGroup.add(westRwyJoin);

      // East perimeter connector to RWY 27R
      const eastPerim = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 30.5), taxiMat);
      eastPerim.position.set(37.5, 0.03, -1.5);
      this.layoutGroup.add(eastPerim);
    } else if (layout === 2) {
      // Intersecting Crosswind Runway RWY 18 (x = -22, z = -31..+14 -> len 45, center z = -8.5)
      this.addRunwayMesh(2, -22.0, -8.5, 45.0, 6.4, Math.PI / 2, "18");
      this.addHoldShortBar(2, -15.2, 11.5, Math.PI / 2);
      this.addGlideslopePath(new THREE.Vector3(-22.0, 8.8, -58.0), new THREE.Vector3(-22.0, 0.4, -26.0));

      // Highlight the shared intersection box at (-22, 0)
      const crossMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.32,
      });
      const crossBox = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.05, 7.0), crossMat);
      crossBox.position.set(-22.0, 0.14, 0.0);
      this.layoutGroup.add(crossBox);
      this.rwyLightStrips[2].push(crossMat);
    }
    this.glideslopeGroup.visible = this.showHalos;
  }

  private addGlideslopePath(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 1.8,
      gapSize: 1.5,
      transparent: true,
      opacity: 0.45,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    this.glideslopeGroup.add(line);
  }

  private addRunwayMesh(
    rwyIndex: 0 | 1 | 2,
    cx: number,
    cz: number,
    length: number,
    width: number,
    rotY: number,
    designator: string,
  ): void {
    const group = new THREE.Group();
    group.position.set(cx, 0.06, cz);
    group.rotation.y = rotY;

    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.14, width),
      this.rwyAsphaltMat,
    );
    surface.receiveShadow = true;
    group.add(surface);

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    // Centerline dashes
    const dashCount = Math.floor(length / 5.5);
    for (let i = 0; i < dashCount; i++) {
      const x = -length / 2 + 7.5 + i * ((length - 15) / Math.max(1, dashCount - 1));
      const dash = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.24), whiteMat);
      dash.position.set(x, 0.08, 0);
      group.add(dash);
    }

    // Threshold piano keys at both ends
    for (const endSign of [-1, 1]) {
      const tx = endSign * (length / 2 - 2.3);
      for (const offsetZ of [-2.0, -1.1, 1.1, 2.0]) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.04, 0.44), whiteMat);
        key.position.set(tx, 0.08, offsetZ);
        group.add(key);
      }
    }

    // Painted runway designator numeral ("27", "27R", "18") inside the approach threshold
    const decal = createRunwayNumberDecal(designator);
    decal.position.set(length / 2 - 6.8, 0.09, 0);
    group.add(decal);

    // Glowing Runway Mutex Edge Strips!
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(length - 1.5, 0.09, 0.26), edgeMat);
      strip.position.set(0, 0.09, side * (width / 2 + 0.12));
      group.add(strip);
    }
    this.rwyLightStrips[rwyIndex].push(edgeMat);

    this.layoutGroup.add(group);
  }

  private addHoldShortBar(rwyIndex: 0 | 1 | 2, x: number, z: number, rotY: number): void {
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.9,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.36), barMat);
    bar.position.set(x, 0.12, z);
    bar.rotation.y = rotY;
    this.layoutGroup.add(bar);
    this.rwyLightStrips[rwyIndex].push(barMat);
  }

  private updateRunwayLights(states: [number, number, number]): void {
    const palette = [
      0x22c55e, // 0: FREE (emerald)
      0x7c5cff, // 1: LOCKED LANDING (signal violet)
      0xf59e0b, // 2: LOCKED TAKEOFF (amber)
      0x38bdf8, // 3: WAKE COOLDOWN (cyan)
      0xef4444, // 4: CONFLICT / GO AROUND (crimson)
    ];

    for (let i = 0; i < 3; i++) {
      const hex = palette[states[i]] ?? 0x22c55e;
      for (const mat of this.rwyLightStrips[i]) {
        mat.color.setHex(hex);
        mat.emissive.setHex(hex);
        mat.emissiveIntensity = states[i] === 4 ? 1.5 : states[i] === 0 ? 0.45 : 0.95;
      }
    }
  }

  private updateActiveGates(activeGates: number): void {
    if (this.currentGates === activeGates) return;
    this.currentGates = activeGates;
    for (let i = 0; i < this.gateMeshes.length; i++) {
      this.gateMeshes[i].visible = i < activeGates;
    }
  }

  private updateWeatherVisuals(weather: number, dt: number): void {
    if (this.currentWeather !== weather) {
      this.currentWeather = weather;
      this.applyThemeColors();
      this.rainLines.visible = weather >= 1;
      this.rwyAsphaltMat.roughness = weather === 0 ? 0.86 : weather === 1 ? 0.35 : 0.22;
      this.rwyAsphaltMat.metalness = weather === 0 ? 0.08 : 0.28;
    }

    // Animate fluffy cartoon clouds drifting gently across the upper sky
    const now = performance.now() * 0.001;
    const cloudSpeedMult = weather === 0 ? 1.0 : weather === 1 ? 1.7 : 2.9;
    const cloudHex = weather === 0 ? 0xffffff : weather === 1 ? 0xdbe5f2 : 0x6b7c93;
    const cloudEmissive = weather === 0 ? 0.16 : weather === 1 ? 0.08 : 0.03;
    for (const child of this.cloudsGroup.children) {
      child.position.x -= dt * (child.userData.speed as number) * cloudSpeedMult;
      if (child.position.x < -72) child.position.x = 72;
      const baseY = child.userData.baseY as number;
      const phase = child.userData.phase as number;
      child.position.y = baseY + Math.sin(now * 0.65 + phase) * 0.55;
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material.color.setHex(cloudHex);
          obj.material.emissive.setHex(cloudHex);
          obj.material.emissiveIntensity = cloudEmissive;
        }
      });
    }

    // Animate windsock droop & flutter
    const droop = weather === 0 ? -0.52 : weather === 1 ? -0.15 : 0.04;
    const flutterSpeed = weather === 0 ? 2.5 : weather === 1 ? 8.0 : 16.0;
    const flutterAmp = weather === 0 ? 0.06 : weather === 1 ? 0.14 : 0.26;
    this.windsockPivot.rotation.z = droop + Math.sin(now * flutterSpeed) * flutterAmp;
    this.windsockPivot.rotation.y = Math.cos(now * (flutterSpeed * 0.6)) * (flutterAmp * 0.9);

    // Animate falling rain streaks
    if (weather >= 1) {
      const fallSpeed = weather === 2 ? 48.0 : 32.0;
      const windX = weather === 2 ? -14.0 : -6.0;
      const posAttr = this.rainLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < this.rainPositions.length; i += 6) {
        this.rainPositions[i] += windX * dt;
        this.rainPositions[i + 1] -= fallSpeed * dt;
        this.rainPositions[i + 3] = this.rainPositions[i] + windX * 0.05;
        this.rainPositions[i + 4] = this.rainPositions[i + 1] - (weather === 2 ? 2.4 : 1.7);
        this.rainPositions[i + 5] = this.rainPositions[i + 2];

        if (this.rainPositions[i + 1] < 0) {
          const nx = (Math.random() - 0.5) * 110;
          const ny = 28 + Math.random() * 10;
          const nz = (Math.random() - 0.5) * 82;
          this.rainPositions[i] = nx;
          this.rainPositions[i + 1] = ny;
          this.rainPositions[i + 2] = nz;
          this.rainPositions[i + 3] = nx + windX * 0.05;
          this.rainPositions[i + 4] = ny - 1.9;
          this.rainPositions[i + 5] = nz;
        }
      }
      posAttr.needsUpdate = true;

      // Occasional subtle storm flash
      if (weather === 2) {
        if (Math.random() < dt * 0.18) {
          this.lightningIntensity = 1.0;
        }
        if (this.lightningIntensity > 0) {
          this.lightningIntensity = Math.max(0, this.lightningIntensity - dt * 4.5);
          this.sunLight.intensity = 1.1 + this.lightningIntensity * 2.2;
        }
      }
    }
  }

  private syncFromSnapshot(snap: SimSnapshot, dt: number): void {
    if (snap.layout !== this.currentLayout) {
      this.rebuildLayoutMeshes(snap.layout);
    }
    this.updateActiveGates(snap.activeGates);
    this.updateRunwayLights(snap.rwyState);
    this.updateWeatherVisuals(snap.weather, dt);

    // Spin control tower radar dish & blink beacon
    this.radarDish.rotation.y += dt * 1.9;
    const blinkOn = Math.floor(snap.simTime * 2.2) % 2 === 0;
    this.towerBeaconMat.color.setHex(blinkOn ? 0xff3b3b : 0x5c1111);

    // Sync aircraft meshes
    const seen = new Set<number>();
    let selectedSnap: AircraftSnapshot | null = null;

    for (const ac of snap.aircraft) {
      seen.add(ac.id);
      if (ac.id === this.selectedEntityId) {
        selectedSnap = ac;
      }

      let bundle = this.aircraftMap.get(ac.id);
      if (!bundle) {
        bundle = createCartoonAircraft(ac.kind, ac.livery, ac.id);
        this.aircraftMap.set(ac.id, bundle);
        this.scene.add(bundle.group);
        this.scene.add(bundle.shadow);
      }

      // Spawn touchdown smoke puffs right as aircraft transitions Final -> Landing!
      if (bundle.lastPhase === 2 && ac.phase === 3) {
        this.spawnTouchdownPuffs(ac.x, ac.z);
      }
      bundle.lastPhase = ac.phase;

      bundle.group.position.set(ac.x, ac.y + 0.52, ac.z);
      bundle.bodyGroup.rotation.set(0, 0, 0);
      // Euler order YXZ: yaw around up axis, pitch nose up/down, roll bank into turns
      bundle.bodyGroup.rotation.order = "YXZ";
      bundle.bodyGroup.rotation.y = ac.yaw;
      bundle.bodyGroup.rotation.x = -ac.pitch;
      bundle.bodyGroup.rotation.z = -ac.roll;

      // Spin propellers on RegionalProp aircraft
      for (const prop of bundle.props) {
        prop.rotation.z += dt * (ac.phase === 5 ? 2.0 : 28.0);
      }

      // Blink tail strobe
      const strobeOn = Math.floor((snap.simTime + ac.id * 0.37) * 3.0) % 2 === 0;
      bundle.strobe.visible = strobeOn;

      // Ground shadow projected cleanly below aircraft
      bundle.shadow.position.set(ac.x, 0.15, ac.z);
      const shadowScale = THREE.MathUtils.clamp(1.0 - ac.y * 0.032, 0.35, 1.0);
      bundle.shadow.scale.setScalar(shadowScale);
      (bundle.shadow.material as THREE.MeshBasicMaterial).opacity =
        THREE.MathUtils.clamp(0.32 - ac.y * 0.012, 0.08, 0.32);

      // Separation halo visibility & warning color
      const airborne = ac.y > 0.4;
      bundle.halo.visible = this.showHalos && (airborne || ac.id === this.selectedEntityId);
      const haloMat = bundle.halo.material as THREE.MeshBasicMaterial;
      if (ac.separationWarning) {
        haloMat.color.setHex(0xef4444);
        haloMat.opacity = 0.72;
      } else if (ac.id === this.selectedEntityId) {
        haloMat.color.setHex(0x7c5cff);
        haloMat.opacity = 0.65;
      } else {
        haloMat.color.setHex(0x38bdf8);
        haloMat.opacity = 0.24;
      }

      // Priority low-fuel beacon ring
      bundle.priorityRing.visible = ac.isPriority;
      if (ac.isPriority) {
        const pulse = 1.0 + Math.sin(snap.simTime * 7.0) * 0.15;
        bundle.priorityRing.scale.setScalar(pulse);
      }

      // Project floating HTML callsign label
      if (this.showLabels) {
        this.updateCallsignLabel(ac);
      }
    }

    // Cleanup despawned aircraft & labels
    for (const [id, bundle] of this.aircraftMap) {
      if (!seen.has(id)) {
        this.scene.remove(bundle.group);
        this.scene.remove(bundle.shadow);
        this.aircraftMap.delete(id);
        const el = this.labelElements.get(id);
        if (el) {
          el.remove();
          this.labelElements.delete(id);
        }
        if (this.selectedEntityId === id) {
          this.selectedEntityId = null;
          this.opts.onSelectAircraft?.(null);
        }
      }
    }

    if (this.selectedEntityId !== null) {
      this.opts.onSelectAircraft?.(selectedSnap);
    }

    if (selectedSnap) {
      this.selectionBeacon.visible = true;
      this.selectionBeacon.position.set(selectedSnap.x, 0.2, selectedSnap.z);
      const pulse = 1.0 + Math.sin(snap.simTime * 5.0) * 0.12;
      this.selectionBeacon.children[0].scale.setScalar(pulse);
      const linePos = this.selectionLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      linePos.setXYZ(0, 0, 0, 0);
      linePos.setXYZ(1, 0, Math.max(selectedSnap.y + 0.3, 0.5), 0);
      linePos.needsUpdate = true;
      this.selectionLine.computeLineDistances();
    } else {
      this.selectionBeacon.visible = false;
    }

    this.syncRadioPulses(snap);
    this.tickPuffs(dt);
  }

  private syncRadioPulses(snap: SimSnapshot): void {
    const active = this.showRadioWaves && snap.pulses.length > 0 ? snap.pulses[0] : null;
    if (!active) {
      this.radioBeamLine.visible = false;
      for (const r of this.radioRipples) r.visible = false;
      return;
    }

    const pulseColors = [
      0x8b5cf6, // 0: Tower -> Plane
      0x10b981, // 1: Plane -> Tower readback
      0xef4444, // 2: Urgent GO AROUND
      0xf59e0b, // 3: Garbled / Say again
    ];
    const hex = pulseColors[active.kind] ?? 0x8b5cf6;

    // Update curved dashed broadcast arc from sender to receiver
    const posAttr = this.radioBeamLine.geometry.getAttribute("position") as THREE.BufferAttribute;
    const segments = posAttr.count - 1;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const x = THREE.MathUtils.lerp(active.fromX, active.toX, u);
      const y = THREE.MathUtils.lerp(active.fromY, active.toY, u) + Math.sin(u * Math.PI) * 3.8;
      const z = THREE.MathUtils.lerp(active.fromZ, active.toZ, u);
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
    this.radioBeamLine.computeLineDistances();
    const beamMat = this.radioBeamLine.material as THREE.LineDashedMaterial;
    beamMat.color.setHex(hex);
    beamMat.opacity = 0.65;
    this.radioBeamLine.visible = true;

    // Three staggered expanding signal ripples riding along the arc
    for (let i = 0; i < this.radioRipples.length; i++) {
      const ripple = this.radioRipples[i];
      const t = active.progress - i * 0.14;
      if (t <= 0.02 || t >= 0.98) {
        ripple.visible = false;
        continue;
      }
      ripple.visible = true;
      const x = THREE.MathUtils.lerp(active.fromX, active.toX, t);
      const y = THREE.MathUtils.lerp(active.fromY, active.toY, t) + Math.sin(t * Math.PI) * 3.8;
      const z = THREE.MathUtils.lerp(active.fromZ, active.toZ, t);
      ripple.position.set(x, y, z);

      // Aim the ripple ring along the local arc tangent
      const tAhead = Math.min(1.0, t + 0.04);
      const nx = THREE.MathUtils.lerp(active.fromX, active.toX, tAhead);
      const ny = THREE.MathUtils.lerp(active.fromY, active.toY, tAhead) + Math.sin(tAhead * Math.PI) * 3.8;
      const nz = THREE.MathUtils.lerp(active.fromZ, active.toZ, tAhead);
      ripple.lookAt(nx, ny, nz);

      const scale = 0.55 + Math.sin(t * Math.PI) * 1.15;
      ripple.scale.setScalar(scale);
      const mat = ripple.material as THREE.MeshBasicMaterial;
      mat.color.setHex(hex);
      mat.opacity = Math.sin(t * Math.PI) * (0.85 - i * 0.2);
    }
  }

  private spawnTouchdownPuffs(x: number, z: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), mat.clone());
      mesh.position.set(x + (Math.random() - 0.5) * 1.2, 0.3, z + (Math.random() - 0.5) * 1.2);
      this.scene.add(mesh);
      this.puffs.push({
        mesh,
        age: 0,
        maxAge: 0.75 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 1.4 + Math.random() * 1.0,
        vz: (Math.random() - 0.5) * 2.2,
      });
    }
  }

  private tickPuffs(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        this.puffs.splice(i, 1);
        continue;
      }
      const k = p.age / p.maxAge;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(1.0 + k * 2.4);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - k) * 0.7;
    }
  }

  private updateCallsignLabel(ac: AircraftSnapshot): void {
    let el = this.labelElements.get(ac.id);
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.className = "atc-pill";
      el.dataset.entityId = String(ac.id);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.selectedEntityId = this.selectedEntityId === ac.id ? null : ac.id;
        if (this.selectedEntityId === null) {
          this.opts.onSelectAircraft?.(null);
        }
      });
      this.opts.labelsLayer.appendChild(el);
      this.labelElements.set(ac.id, el);
    }

    this.projVec.set(ac.x, ac.y + 2.7, ac.z).project(this.camera);
    const width = this.opts.container.clientWidth;
    const height = this.opts.container.clientHeight;
    const inFront = this.projVec.z < 1.0 && this.projVec.z > -1.0;

    if (!inFront) {
      el.style.display = "none";
      return;
    }

    const sx = (this.projVec.x * 0.5 + 0.5) * width;
    const sy = (-this.projVec.y * 0.5 + 0.5) * height;
    if (sx < -24 || sx > width + 24 || sy < -16 || sy > height + 16) {
      el.style.display = "none";
      return;
    }

    const clampedX = THREE.MathUtils.clamp(sx, 54, Math.max(54, width - 54));
    const clampedY = THREE.MathUtils.clamp(sy, 46, Math.max(46, height - 36));
    el.style.display = "";
    el.style.transform = `translate(-50%, -100%) translate(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px)`;
    el.textContent = `${ac.callsign} · ${ac.phaseLabel}`;
    el.classList.toggle("is-selected", ac.id === this.selectedEntityId);
    el.classList.toggle("is-warn", ac.separationWarning || ac.phase === 12);
    el.classList.toggle("is-priority", ac.isPriority);
  }

  private applyThemeColors(): void {
    const isDark =
      document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.dataset.theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    const weather = Math.max(0, this.currentWeather);
    let bgHex: number;
    if (isDark) {
      bgHex = weather === 0 ? 0x161425 : weather === 1 ? 0x151927 : 0x10121c;
      this.islandTopMat.color.setHex(weather === 2 ? 0x2d5440 : 0x3b7d54);
      this.islandBaseMat.color.setHex(0x4c404b);
      this.ambientLight.intensity = weather === 0 ? 0.95 : weather === 1 ? 0.75 : 0.55;
      this.sunLight.intensity = weather === 0 ? 1.25 : weather === 1 ? 0.85 : 0.65;
    } else {
      bgHex = weather === 0 ? 0xdceeff : weather === 1 ? 0xc2d0e2 : 0x8f9db3;
      this.islandTopMat.color.setHex(weather === 2 ? 0x528f5e : 0x76c876);
      this.islandBaseMat.color.setHex(0xc4a279);
      this.ambientLight.intensity = weather === 0 ? 1.2 : weather === 1 ? 0.92 : 0.72;
      this.sunLight.intensity = weather === 0 ? 1.45 : weather === 1 ? 0.95 : 0.7;
    }

    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.Fog(bgHex, 185, 360);
  }

  private updateCameraPosition(): void {
    const sinP = Math.sin(this.orbitPolar);
    const x = this.orbitTarget.x + this.orbitDistance * sinP * Math.sin(this.orbitAzimuth);
    const y = this.orbitTarget.y + this.orbitDistance * Math.cos(this.orbitPolar);
    const z = this.orbitTarget.z + this.orbitDistance * sinP * Math.cos(this.orbitAzimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.orbitTarget);
  }

  private bindInteractions(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.pointerMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });

    dom.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.pointerMoved = true;
      }
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.orbitAzimuth -= dx * 0.007;
      this.orbitPolar = THREE.MathUtils.clamp(this.orbitPolar - dy * 0.006, 0.34, 1.32);
      this.updateCameraPosition();
    });

    dom.addEventListener("pointerup", (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      dom.releasePointerCapture(e.pointerId);
      if (!this.pointerMoved) {
        this.pickAircraftAt(e);
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      if (this.destroyed) return;
      const w = Math.max(this.opts.container.clientWidth, 260);
      const h = Math.max(this.opts.container.clientHeight, 220);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(this.opts.container);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries.some((entry) => entry.isIntersecting);
        if (this.isVisible) {
          this.lastFrameMs = performance.now();
        }
      },
      { threshold: 0.05 },
    );
    this.intersectionObserver.observe(this.opts.container);

    this.themeObserver = new MutationObserver(() => this.applyThemeColors());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  private pickAircraftAt(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const targets: THREE.Object3D[] = [];
    for (const bundle of this.aircraftMap.values()) {
      targets.push(bundle.bodyGroup);
    }
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && obj.userData.entityId === undefined) {
        obj = obj.parent;
      }
      if (obj && typeof obj.userData.entityId === "number") {
        this.selectedEntityId = obj.userData.entityId;
        return;
      }
    }
    this.selectedEntityId = null;
    this.opts.onSelectAircraft?.(null);
  }

  private loop = (nowMs: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.loop);

    if (!this.isVisible) return;

    const rawDt = Math.min((nowMs - this.lastFrameMs) * 0.001, 0.05);
    this.lastFrameMs = nowMs;

    const simDt = this.paused ? 0 : rawDt * this.speedMultiplier;
    if (simDt > 0) {
      this.sim.step(simDt);
    }

    const snap = this.sim.readSnapshot();
    this.syncFromSnapshot(snap, this.paused ? 0 : rawDt);
    this.renderer.render(this.scene, this.camera);

    this.uiThrottle += rawDt;
    if (this.uiThrottle >= 0.16) {
      this.uiThrottle = 0;
      this.opts.onSnapshot?.(snap, this.sim.readRadioLog());
    }
  };
}

function createRunwayNumberDecal(label: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 58px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 64, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function createCartoonTree(scale: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 1.3, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.9, flatShading: true }),
  );
  trunk.position.y = 0.65;
  trunk.castShadow = true;
  g.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x2e8b57,
    roughness: 0.85,
    flatShading: true,
  });
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.4, 7), foliageMat);
  c1.position.y = 2.1;
  c1.castShadow = true;
  g.add(c1);

  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.9, 7), foliageMat);
  c2.position.y = 3.2;
  c2.castShadow = true;
  g.add(c2);

  g.scale.setScalar(scale);
  return g;
}

function createCartoonAircraft(kind: number, livery: number, entityId: number): AircraftMeshBundle {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.userData.entityId = entityId;
  group.add(bodyGroup);

  const accentColor = LIVERY_COLORS[livery % LIVERY_COLORS.length];
  const scale = kind === 0 ? 0.84 : kind === 1 ? 1.0 : 1.24;

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.38,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.15,
    metalness: 0.5,
  });

  // Chunky rounded capsule fuselage aligned along +Z (nose at +Z, tail at -Z)
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 2.25, 6, 10), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  bodyGroup.add(fuselage);

  // Cute cockpit windshield band near the nose (+Z)
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 0.58), glassMat);
  cockpit.position.set(0, 0.24, 1.12);
  bodyGroup.add(cockpit);

  // Colourful belly stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.22, 1.9), accentMat);
  stripe.position.set(0, -0.05, -0.1);
  bodyGroup.add(stripe);

  // Wings (high-wing for RegionalProp, low swept wing for jets)
  const wingY = kind === 0 ? 0.34 : -0.06;
  const wingSpan = kind === 0 ? 4.3 : kind === 1 ? 4.6 : 5.2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.18, 1.15), hullMat);
  wing.position.set(0, wingY, 0.08);
  wing.castShadow = true;
  bodyGroup.add(wing);

  // Coloured wingtips
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.95), accentMat);
    tip.position.set(side * (wingSpan / 2 + 0.05), wingY + 0.14, -0.05);
    bodyGroup.add(tip);

    // Wingtip nav lights (red port/left = +X when nose is +Z? Left of +Z is +X! Wait: cross(up,+Z) = +X = Left!)
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color: side > 0 ? 0xef4444 : 0x22c55e }),
    );
    navLight.position.set(side * (wingSpan / 2 + 0.18), wingY + 0.28, 0.25);
    bodyGroup.add(navLight);
  }

  // Tail fin & horizontal stabiliser
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.92), accentMat);
  tailFin.position.set(0, 0.72, -1.28);
  tailFin.rotation.x = -0.22;
  tailFin.castShadow = true;
  bodyGroup.add(tailFin);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 0.65), hullMat);
  hStab.position.set(0, kind === 0 ? 1.25 : 0.12, -1.32);
  bodyGroup.add(hStab);

  // Engines or spinning propellers
  const props: THREE.Object3D[] = [];
  if (kind === 0) {
    // Twin turboprops on wings
    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.85, 8), accentMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(side * 1.15, wingY - 0.14, 0.55);
      bodyGroup.add(pod);

      const propGroup = new THREE.Group();
      propGroup.position.set(side * 1.15, wingY - 0.14, 1.02);
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.12, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x1e293b }),
      );
      propGroup.add(blade);
      bodyGroup.add(propGroup);
      props.push(propGroup);
    }
  } else {
    // Twin underwing turbofan pods (or 4 on WideBody!)
    const offsets = kind === 2 ? [-1.85, -1.0, 1.0, 1.85] : [-1.15, 1.15];
    for (const ox of offsets) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.92, 8), accentMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(ox, wingY - 0.28, 0.32);
      bodyGroup.add(nacelle);
    }
  }

  // Blinking white strobe on tail
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  strobe.position.set(0, 1.45, -1.45);
  bodyGroup.add(strobe);

  bodyGroup.scale.setScalar(scale);

  // Translucent separation halo ring around the aircraft
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 3.85, 28),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  group.add(halo);

  // Golden pulsing ring for priority low-fuel aircraft
  const priorityRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.5, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  priorityRing.rotation.x = -Math.PI / 2;
  priorityRing.visible = false;
  group.add(priorityRing);

  // Soft circular ground shadow projected beneath the plane
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.0 * scale, 16),
    new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;

  return {
    group,
    bodyGroup,
    shadow,
    halo,
    priorityRing,
    props,
    strobe,
    kind,
    lastPhase: -1,
  };
}
