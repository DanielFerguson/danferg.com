/**
 * TypeScript bridge to the compiled Rust ECS (`public/wasm/atc_sim.wasm`).
 *
 * Reads flat `Float32Array` snapshots directly from WASM linear memory
 * without JSON parsing or heap churn on the hot animation loop.
 */

export const HEADER_FLOATS = 24;
export const AIRCRAFT_FLOATS = 16;
export const PULSE_FLOATS = 8;

export const PHASE_LABELS = [
  "APPROACH",
  "HOLDING",
  "FINAL",
  "LANDING",
  "TAXI IN",
  "AT GATE",
  "PUSHBACK",
  "TAXI OUT",
  "HOLD SHORT",
  "LINE UP",
  "TAKEOFF",
  "CLIMBING",
  "GO AROUND",
] as const;

export const KIND_LABELS = ["Regional Prop", "Narrow-Body", "Wide-Body"] as const;
export const RUNWAY_LABELS = ["RWY 27", "RWY 27R", "RWY 18"] as const;
export const WEATHER_LABELS = ["Clear", "Rain", "Storm"] as const;
export const LAYOUT_LABELS = [
  "Single Runway",
  "Parallel Runways",
  "Intersecting Runways",
] as const;

export type ScenarioPresetId = 0 | 1 | 2 | 3;

export interface AircraftSnapshot {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  phase: number;
  phaseLabel: string;
  kind: number;
  livery: number;
  runway: number;
  isPriority: boolean;
  separationWarning: boolean;
  awaitingClearance: boolean;
  nearestDist: number;
  callsign: string;
}

export interface RadioPulseSnapshot {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  progress: number;
  kind: number; // 0=tower, 1=pilot, 2=urgent, 3=error
}

export interface RadioLogEntry {
  timestamp: number;
  severity: number;
  speaker: string;
  text: string;
}

export interface SimSnapshot {
  simTime: number;
  layout: number;
  weather: number;
  activeGates: number;
  rwyState: [number, number, number];
  rwyHolder: [number, number, number];
  totalLandings: number;
  totalTakeoffs: number;
  totalGoArounds: number;
  totalSeparationWarnings: number;
  runwayUtilizationPct: number;
  avgHoldDelaySecs: number;
  holdingCount: number;
  commsQueueLen: number;
  totalReadbackErrors: number;
  conflictFlashTimer: number;
  radioDelay: number;
  trafficRate: number;
  aircraft: AircraftSnapshot[];
  pulses: RadioPulseSnapshot[];
}

interface AtcWasmExports {
  memory: WebAssembly.Memory;
  sim_create(presetId: number): number;
  sim_destroy(handle: number): void;
  sim_reset(handle: number, presetId: number): void;
  sim_step(handle: number, dt: number): void;
  sim_snapshot_ptr(handle: number): number;
  sim_snapshot_len(handle: number): number;
  sim_radio_log_ptr(handle: number): number;
  sim_radio_log_len(handle: number): number;
  sim_set_weather(handle: number, weatherId: number): void;
  sim_set_traffic_rate(handle: number, rate: number): void;
  sim_set_radio_delay(handle: number, delaySecs: number): void;
  sim_set_readback_errors(handle: number, enabled: number): void;
  sim_set_layout(handle: number, layoutId: number): void;
  sim_set_active_gates(handle: number, gates: number): void;
  sim_set_separation_factor(handle: number, factor: number): void;
  sim_trigger_go_around(handle: number): void;
  sim_trigger_rush_hour(handle: number): void;
  sim_trigger_priority(handle: number): void;
}

let cachedModulePromise: Promise<AtcWasmExports> | null = null;
const textDecoder = new TextDecoder("utf-8");

export function loadAtcWasm(): Promise<AtcWasmExports> {
  if (!cachedModulePromise) {
    cachedModulePromise = (async () => {
      const response = await fetch("/wasm/atc_sim.wasm");
      if (!response.ok) {
        throw new Error(`Failed to fetch /wasm/atc_sim.wasm (${response.status})`);
      }
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      return instance.exports as unknown as AtcWasmExports;
    })();
  }
  return cachedModulePromise;
}

function decodeCallsign(loFloat: number, hiFloat: number): string {
  const lo = Math.round(loFloat) >>> 0;
  const hi = Math.round(hiFloat) >>> 0;
  const bytes = [
    lo & 0xff,
    (lo >>> 8) & 0xff,
    (lo >>> 16) & 0xff,
    hi & 0xff,
    (hi >>> 8) & 0xff,
    (hi >>> 16) & 0xff,
  ];
  let out = "";
  for (const b of bytes) {
    if (b === 0) break;
    out += String.fromCharCode(b);
  }
  return out || "ACFT";
}

export class AtcSimClient {
  private wasm: AtcWasmExports;
  private handle: number;
  private destroyed = false;

  private constructor(wasm: AtcWasmExports, handle: number) {
    this.wasm = wasm;
    this.handle = handle;
  }

  static async create(preset: ScenarioPresetId): Promise<AtcSimClient> {
    const wasm = await loadAtcWasm();
    const handle = wasm.sim_create(preset);
    return new AtcSimClient(wasm, handle);
  }

  destroy(): void {
    if (!this.destroyed) {
      this.destroyed = true;
      this.wasm.sim_destroy(this.handle);
    }
  }

  reset(preset: ScenarioPresetId): void {
    if (this.destroyed) return;
    this.wasm.sim_reset(this.handle, preset);
  }

  step(dt: number): void {
    if (this.destroyed) return;
    this.wasm.sim_step(this.handle, dt);
  }

  setWeather(weatherId: number): void {
    if (!this.destroyed) this.wasm.sim_set_weather(this.handle, weatherId);
  }

  setTrafficRate(rate: number): void {
    if (!this.destroyed) this.wasm.sim_set_traffic_rate(this.handle, rate);
  }

  setRadioDelay(delaySecs: number): void {
    if (!this.destroyed) this.wasm.sim_set_radio_delay(this.handle, delaySecs);
  }

  setReadbackErrors(enabled: boolean): void {
    if (!this.destroyed) this.wasm.sim_set_readback_errors(this.handle, enabled ? 1 : 0);
  }

  setLayout(layoutId: number): void {
    if (!this.destroyed) this.wasm.sim_set_layout(this.handle, layoutId);
  }

  setActiveGates(gates: number): void {
    if (!this.destroyed) this.wasm.sim_set_active_gates(this.handle, gates);
  }

  setSeparationFactor(factor: number): void {
    if (!this.destroyed) this.wasm.sim_set_separation_factor(this.handle, factor);
  }

  triggerGoAround(): void {
    if (!this.destroyed) this.wasm.sim_trigger_go_around(this.handle);
  }

  triggerRushHour(): void {
    if (!this.destroyed) this.wasm.sim_trigger_rush_hour(this.handle);
  }

  triggerPriority(): void {
    if (!this.destroyed) this.wasm.sim_trigger_priority(this.handle);
  }

  readSnapshot(): SimSnapshot {
    const ptr = this.wasm.sim_snapshot_ptr(this.handle);
    const len = this.wasm.sim_snapshot_len(this.handle);
    const view = new Float32Array(this.wasm.memory.buffer, ptr, len);

    const acCount = Math.round(view[1]);
    const pulseCount = Math.round(view[2]);

    const aircraft: AircraftSnapshot[] = new Array(acCount);
    let offset = HEADER_FLOATS;
    for (let i = 0; i < acCount; i++) {
      const phase = Math.round(view[offset + 8]);
      const flags = Math.round(view[offset + 12]);
      aircraft[i] = {
        id: Math.round(view[offset]),
        x: view[offset + 1],
        y: view[offset + 2],
        z: view[offset + 3],
        yaw: view[offset + 4],
        pitch: view[offset + 5],
        roll: view[offset + 6],
        speed: view[offset + 7],
        phase,
        phaseLabel: PHASE_LABELS[phase] ?? "UNKNOWN",
        kind: Math.round(view[offset + 9]),
        livery: Math.round(view[offset + 10]),
        runway: Math.round(view[offset + 11]),
        isPriority: (flags & 1) !== 0,
        separationWarning: (flags & 2) !== 0,
        awaitingClearance: (flags & 4) !== 0,
        nearestDist: view[offset + 13],
        callsign: decodeCallsign(view[offset + 14], view[offset + 15]),
      };
      offset += AIRCRAFT_FLOATS;
    }

    const pulses: RadioPulseSnapshot[] = new Array(pulseCount);
    for (let i = 0; i < pulseCount; i++) {
      pulses[i] = {
        fromX: view[offset],
        fromY: view[offset + 1],
        fromZ: view[offset + 2],
        toX: view[offset + 3],
        toY: view[offset + 4],
        toZ: view[offset + 5],
        progress: view[offset + 6],
        kind: Math.round(view[offset + 7]),
      };
      offset += PULSE_FLOATS;
    }

    return {
      simTime: view[0],
      layout: Math.round(view[3]),
      weather: Math.round(view[4]),
      activeGates: Math.round(view[5]),
      rwyState: [Math.round(view[6]), Math.round(view[7]), Math.round(view[8])],
      rwyHolder: [Math.round(view[19]), Math.round(view[20]), Math.round(view[21])],
      totalLandings: Math.round(view[9]),
      totalTakeoffs: Math.round(view[10]),
      totalGoArounds: Math.round(view[11]),
      totalSeparationWarnings: Math.round(view[12]),
      runwayUtilizationPct: view[13],
      avgHoldDelaySecs: view[14],
      holdingCount: Math.round(view[15]),
      commsQueueLen: Math.round(view[16]),
      totalReadbackErrors: Math.round(view[17]),
      conflictFlashTimer: view[18],
      radioDelay: view[22],
      trafficRate: view[23],
      aircraft,
      pulses,
    };
  }

  readRadioLog(): RadioLogEntry[] {
    const ptr = this.wasm.sim_radio_log_ptr(this.handle);
    const len = this.wasm.sim_radio_log_len(this.handle);
    if (len === 0) return [];
    const bytes = new Uint8Array(this.wasm.memory.buffer, ptr, len);
    const raw = textDecoder.decode(bytes);
    const entries: RadioLogEntry[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      const parts = line.split("|");
      if (parts.length < 4) continue;
      entries.push({
        timestamp: Number.parseFloat(parts[0]) || 0,
        severity: Number.parseInt(parts[1], 10) || 0,
        speaker: parts[2],
        text: parts.slice(3).join("|"),
      });
    }
    return entries;
  }
}
