/**
 * Client-side controller wiring for `AtcMiniScene.astro` and `AtcSandbox.astro`.
 *
 * Scoped exclusively to pages that render ATC simulation components.
 */

import { CartoonAirportScene } from "./cartoon-scene";
import {
  KIND_LABELS,
  RUNWAY_LABELS,
  type AircraftSnapshot,
  type RadioLogEntry,
  type ScenarioPresetId,
  type SimSnapshot,
} from "./wasm-bridge";

const PRESET_NAME_TO_ID: Record<string, ScenarioPresetId> = {
  "happy-path": 0,
  "radio-lag": 1,
  "weather-cascade": 2,
  flagship: 3,
};

function renderRadioLog(container: HTMLElement | null, entries: RadioLogEntry[]): void {
  if (!container) return;
  const recent = entries.slice(-10);
  const sig = recent.map((e) => `${e.timestamp.toFixed(1)}:${e.speaker}:${e.text}`).join("|");
  if (container.dataset.logSig === sig) return;
  container.dataset.logSig = sig;

  container.innerHTML = "";
  for (const entry of recent) {
    const row = document.createElement("div");
    row.className = `atc-log__row atc-log__row--sev-${entry.severity}`;

    const time = document.createElement("span");
    time.className = "atc-log__time";
    time.textContent = `${entry.timestamp.toFixed(1)}s`;

    const speaker = document.createElement("span");
    speaker.className = "atc-log__speaker";
    speaker.textContent = entry.speaker;

    const text = document.createElement("span");
    text.className = "atc-log__text";
    text.textContent = entry.text;

    row.append(time, speaker, text);
    container.appendChild(row);
  }
  container.scrollTop = container.scrollHeight;
}

function renderInspector(container: HTMLElement | null, ac: AircraftSnapshot | null): void {
  if (!container) return;
  if (!ac) {
    container.innerHTML =
      '<p class="atc-inspector__empty">Click any plane or callsign pill to inspect its live Rust ECS components.</p>';
    return;
  }
  const kind = KIND_LABELS[ac.kind] ?? "Aircraft";
  const rwy = RUNWAY_LABELS[ac.runway] ?? "RWY 27";
  const sepText = ac.nearestDist >= 99 ? "Clear" : `${ac.nearestDist.toFixed(1)}m`;
  const badges: string[] = [];
  if (ac.isPriority) badges.push('<span class="atc-badge atc-badge--priority">PRIORITY</span>');
  if (ac.separationWarning) badges.push('<span class="atc-badge atc-badge--warn">SEP WARN</span>');
  if (ac.awaitingClearance) badges.push('<span class="atc-badge">AWAITING RADIO</span>');

  container.innerHTML = `
    <div class="atc-inspector__head">
      <strong>${ac.callsign}</strong>
      <span class="atc-inspector__entity">Entity(${ac.id})</span>
      ${badges.join("")}
    </div>
    <dl class="atc-inspector__grid">
      <div><dt>FlightPhase</dt><dd>${ac.phaseLabel}</dd></div>
      <div><dt>AircraftKind</dt><dd>${kind}</dd></div>
      <div><dt>Runway</dt><dd>${rwy}</dd></div>
      <div><dt>Altitude</dt><dd>${(ac.y * 120).toFixed(0)} ft</dd></div>
      <div><dt>Speed</dt><dd>${(ac.speed * 11).toFixed(0)} kt</dd></div>
      <div><dt>Nearest Acft</dt><dd>${sepText}</dd></div>
    </dl>
  `;
}

function setMetric(root: Element, name: string, value: string): void {
  const el = root.querySelector(`[data-metric="${name}"]`);
  if (el) el.textContent = value;
}

function updateVhfPill(root: Element, snap: SimSnapshot): void {
  const pill = root.querySelector<HTMLElement>("[data-vhf-status]");
  if (!pill) return;
  const active = snap.pulses.length > 0;
  const q = snap.commsQueueLen;
  pill.classList.toggle("is-busy", active);
  pill.classList.toggle("is-urgent", active && snap.pulses[0].kind === 2);
  pill.classList.toggle("is-error", active && snap.pulses[0].kind === 3);
  if (active) {
    const mode =
      snap.pulses[0].kind === 2
        ? "URGENT TX"
        : snap.pulses[0].kind === 3
          ? "GARBLED TX"
          : snap.pulses[0].kind === 1
            ? "PILOT TX"
            : "TOWER TX";
    pill.textContent = q > 1 ? `120.5 MHz · ${mode} (+${q - 1} queued)` : `120.5 MHz · ${mode}`;
  } else {
    pill.textContent = "120.5 MHz · IDLE";
  }
}

function formatRunwayLock(state: number, holderId: number): string {
  switch (state) {
    case 1:
      return `LANDING (#${holderId})`;
    case 2:
      return `TAKEOFF (#${holderId})`;
    case 3:
      return "WAKE BUFFER";
    case 4:
      return "CONFLICT!";
    default:
      return "FREE";
  }
}

export async function mountMiniScene(root: HTMLElement): Promise<void> {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";

  const presetKey = root.dataset.preset || "happy-path";
  const presetId = PRESET_NAME_TO_ID[presetKey] ?? 0;

  const canvasHost = root.querySelector<HTMLElement>("[data-atc-canvas]");
  const labelsLayer = root.querySelector<HTMLElement>("[data-atc-labels]");
  const logEl = root.querySelector<HTMLElement>("[data-atc-log]");
  const inspectorEl = root.querySelector<HTMLElement>("[data-atc-inspector]");
  const loadingEl = root.querySelector<HTMLElement>("[data-atc-loading]");
  if (!canvasHost || !labelsLayer) return;

  const scene = new CartoonAirportScene({
    container: canvasHost,
    labelsLayer,
    preset: presetId,
    cameraDistance: presetId === 0 ? 118 : 124,
    onSnapshot: (snap: SimSnapshot, log: RadioLogEntry[]) => {
      setMetric(root, "rwy-lock", formatRunwayLock(snap.rwyState[0], snap.rwyHolder[0]));
      setMetric(root, "landings", String(snap.totalLandings));
      setMetric(root, "takeoffs", String(snap.totalTakeoffs));
      setMetric(root, "go-arounds", String(snap.totalGoArounds));
      setMetric(root, "holding", String(snap.holdingCount));
      setMetric(root, "comms-q", String(snap.commsQueueLen));
      setMetric(root, "readback-errs", String(snap.totalReadbackErrors));
      setMetric(root, "rwy-util", `${snap.runwayUtilizationPct.toFixed(0)}%`);
      setMetric(root, "avg-hold", `${snap.avgHoldDelaySecs.toFixed(1)}s`);
      updateVhfPill(root, snap);
      renderRadioLog(logEl, log);
    },
    onSelectAircraft: (ac) => renderInspector(inspectorEl, ac),
  });

  try {
    await scene.init();
    loadingEl?.remove();
  } catch (err) {
    if (loadingEl) {
      loadingEl.textContent = `Could not start Rust WASM simulation: ${err instanceof Error ? err.message : String(err)}`;
    }
    return;
  }

  const playBtn = root.querySelector<HTMLButtonElement>('[data-action="toggle-play"]');
  const syncPlayButton = () => {
    if (!playBtn) return;
    playBtn.textContent = scene.isPaused() ? "Play" : "Pause";
    playBtn.setAttribute("aria-pressed", String(!scene.isPaused()));
  };
  syncPlayButton();

  playBtn?.addEventListener("click", () => {
    scene.setPaused(!scene.isPaused());
    syncPlayButton();
  });

  root.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", () => {
    scene.resetScenario(presetId);
    // Reset mini controls to preset defaults if present
    const delayInput = root.querySelector<HTMLInputElement>('[data-control="radio-delay"]');
    if (delayInput) {
      delayInput.value = presetId === 1 ? "2.2" : "0.15";
      const out = root.querySelector<HTMLElement>('[data-output="radio-delay"]');
      if (out) out.textContent = `${Number(delayInput.value).toFixed(1)}s`;
    }
    const trafficInput = root.querySelector<HTMLInputElement>('[data-control="traffic-rate"]');
    if (trafficInput) {
      trafficInput.value = presetId === 2 ? "1.45" : "0.65";
      const out = root.querySelector<HTMLElement>('[data-output="traffic-rate"]');
      if (out) out.textContent = `${Number(trafficInput.value).toFixed(2)}×`;
    }
  });

  root.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener("click", () => {
    scene.zoom(-14);
  });
  root.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener("click", () => {
    scene.zoom(14);
  });
  root.querySelector<HTMLButtonElement>('[data-action="reset-cam"]')?.addEventListener("click", () => {
    scene.resetCamera();
  });

  // Mini-scene specific controls
  const delaySlider = root.querySelector<HTMLInputElement>('[data-control="radio-delay"]');
  delaySlider?.addEventListener("input", () => {
    const val = Number(delaySlider.value);
    scene.getSim().setRadioDelay(val);
    const out = root.querySelector<HTMLElement>('[data-output="radio-delay"]');
    if (out) out.textContent = `${val.toFixed(1)}s`;
  });

  const readbackToggle = root.querySelector<HTMLInputElement>('[data-control="readback-errors"]');
  readbackToggle?.addEventListener("change", () => {
    scene.getSim().setReadbackErrors(readbackToggle.checked);
  });

  const trafficSlider = root.querySelector<HTMLInputElement>('[data-control="traffic-rate"]');
  trafficSlider?.addEventListener("input", () => {
    const val = Number(trafficSlider.value);
    scene.getSim().setTrafficRate(val);
    const out = root.querySelector<HTMLElement>('[data-output="traffic-rate"]');
    if (out) out.textContent = `${val.toFixed(2)}×`;
  });

  const weatherBtns = root.querySelectorAll<HTMLButtonElement>("[data-weather]");
  weatherBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.weather);
      scene.getSim().setWeather(id);
      weatherBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
    });
  });

  const labelsToggle = root.querySelector<HTMLInputElement>('[data-overlay="labels"]');
  labelsToggle?.addEventListener("change", () => {
    scene.setOverlays({ labels: labelsToggle.checked });
  });
}

export async function mountFlagshipSandbox(root: HTMLElement): Promise<void> {
  if (root.dataset.mounted === "true") return;
  root.dataset.mounted = "true";

  const canvasHost = root.querySelector<HTMLElement>("[data-atc-canvas]");
  const labelsLayer = root.querySelector<HTMLElement>("[data-atc-labels]");
  const logEl = root.querySelector<HTMLElement>("[data-atc-log]");
  const inspectorEl = root.querySelector<HTMLElement>("[data-atc-inspector]");
  const loadingEl = root.querySelector<HTMLElement>("[data-atc-loading]");
  if (!canvasHost || !labelsLayer) return;

  const scene = new CartoonAirportScene({
    container: canvasHost,
    labelsLayer,
    preset: 3,
    cameraDistance: 126,
    onSnapshot: (snap: SimSnapshot, log: RadioLogEntry[]) => {
      setMetric(root, "landings", String(snap.totalLandings));
      setMetric(root, "takeoffs", String(snap.totalTakeoffs));
      setMetric(root, "go-arounds", String(snap.totalGoArounds));
      setMetric(root, "holding", String(snap.holdingCount));
      setMetric(root, "rwy-util", `${snap.runwayUtilizationPct.toFixed(0)}%`);
      setMetric(root, "comms-q", String(snap.commsQueueLen));
      setMetric(root, "sep-warns", String(snap.totalSeparationWarnings));
      setMetric(root, "avg-hold", `${snap.avgHoldDelaySecs.toFixed(1)}s`);
      updateVhfPill(root, snap);
      renderRadioLog(logEl, log);
    },
    onSelectAircraft: (ac) => renderInspector(inspectorEl, ac),
  });

  try {
    await scene.init();
    loadingEl?.remove();
  } catch (err) {
    if (loadingEl) {
      loadingEl.textContent = `Could not start Rust WASM simulation: ${err instanceof Error ? err.message : String(err)}`;
    }
    return;
  }

  const sim = scene.getSim();

  // Playback & camera controls
  const playBtn = root.querySelector<HTMLButtonElement>('[data-action="toggle-play"]');
  const syncPlay = () => {
    if (!playBtn) return;
    playBtn.textContent = scene.isPaused() ? "Play" : "Pause";
    playBtn.setAttribute("aria-pressed", String(!scene.isPaused()));
  };
  syncPlay();

  playBtn?.addEventListener("click", () => {
    scene.setPaused(!scene.isPaused());
    syncPlay();
  });

  const speedBtns = root.querySelectorAll<HTMLButtonElement>("[data-speed]");
  speedBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      scene.setSpeed(Number(btn.dataset.speed) || 1);
      speedBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
    });
  });

  root.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener("click", () => scene.zoom(-15));
  root.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener("click", () => scene.zoom(15));
  root.querySelector<HTMLButtonElement>('[data-action="reset-cam"]')?.addEventListener("click", () => scene.resetCamera());

  const expandBtn = root.querySelector<HTMLButtonElement>('[data-action="toggle-expand"]');
  const setExpanded = (expanded: boolean) => {
    root.classList.toggle("is-expanded", expanded);
    document.body.classList.toggle("atc-modal-open", expanded);
    if (expandBtn) {
      expandBtn.textContent = expanded ? "Close" : "Expand";
      expandBtn.setAttribute("aria-pressed", String(expanded));
    }
  };
  expandBtn?.addEventListener("click", () => {
    setExpanded(!root.classList.contains("is-expanded"));
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-expanded")) {
      setExpanded(false);
    }
  });

  // God Panel: Layout buttons
  const layoutBtns = root.querySelectorAll<HTMLButtonElement>("[data-layout]");
  const setLayoutUi = (id: number) => {
    sim.setLayout(id);
    layoutBtns.forEach((b) => b.classList.toggle("is-active", Number(b.dataset.layout) === id));
  };
  layoutBtns.forEach((btn) => {
    btn.addEventListener("click", () => setLayoutUi(Number(btn.dataset.layout)));
  });

  // God Panel: Weather buttons
  const weatherBtns = root.querySelectorAll<HTMLButtonElement>("[data-weather]");
  const setWeatherUi = (id: number) => {
    sim.setWeather(id);
    weatherBtns.forEach((b) => b.classList.toggle("is-active", Number(b.dataset.weather) === id));
  };
  weatherBtns.forEach((btn) => {
    btn.addEventListener("click", () => setWeatherUi(Number(btn.dataset.weather)));
  });

  // God Panel: Separation buttons
  const sepBtns = root.querySelectorAll<HTMLButtonElement>("[data-sep]");
  const setSepUi = (val: number) => {
    sim.setSeparationFactor(val);
    sepBtns.forEach((b) => b.classList.toggle("is-active", Math.abs(Number(b.dataset.sep) - val) < 0.05));
  };
  sepBtns.forEach((btn) => {
    btn.addEventListener("click", () => setSepUi(Number(btn.dataset.sep)));
  });

  // God Panel: Sliders
  const bindRange = (
    name: string,
    format: (v: number) => string,
    onChange: (v: number) => void,
  ) => {
    const input = root.querySelector<HTMLInputElement>(`[data-control="${name}"]`);
    const out = root.querySelector<HTMLElement>(`[data-output="${name}"]`);
    const apply = (val: number) => {
      if (input) input.value = String(val);
      if (out) out.textContent = format(val);
      onChange(val);
    };
    input?.addEventListener("input", () => apply(Number(input.value)));
    return apply;
  };

  const setTrafficUi = bindRange(
    "traffic-rate",
    (v) => `${v.toFixed(2)}×`,
    (v) => sim.setTrafficRate(v),
  );
  const setDelayUi = bindRange(
    "radio-delay",
    (v) => `${v.toFixed(1)}s`,
    (v) => sim.setRadioDelay(v),
  );
  const setGatesUi = bindRange(
    "active-gates",
    (v) => `${Math.round(v)}`,
    (v) => sim.setActiveGates(Math.round(v)),
  );

  const readbackInput = root.querySelector<HTMLInputElement>('[data-control="readback-errors"]');
  const setReadbackUi = (checked: boolean) => {
    if (readbackInput) readbackInput.checked = checked;
    sim.setReadbackErrors(checked);
  };
  readbackInput?.addEventListener("change", () => sim.setReadbackErrors(readbackInput.checked));

  // Overlay toggles
  root.querySelector<HTMLInputElement>('[data-overlay="labels"]')?.addEventListener("change", (e) => {
    scene.setOverlays({ labels: (e.target as HTMLInputElement).checked });
  });
  root.querySelector<HTMLInputElement>('[data-overlay="halos"]')?.addEventListener("change", (e) => {
    scene.setOverlays({ halos: (e.target as HTMLInputElement).checked });
  });
  root.querySelector<HTMLInputElement>('[data-overlay="radio-waves"]')?.addEventListener("change", (e) => {
    scene.setOverlays({ radioWaves: (e.target as HTMLInputElement).checked });
  });

  // Scenario Presets & Chaos Actions
  root.querySelector<HTMLButtonElement>('[data-scenario="calm"]')?.addEventListener("click", () => {
    scene.resetScenario(3);
    setLayoutUi(0);
    setWeatherUi(0);
    setTrafficUi(0.75);
    setDelayUi(0.3);
    setGatesUi(4);
    setSepUi(1.0);
    setReadbackUi(false);
  });

  root.querySelector<HTMLButtonElement>('[data-scenario="radio-chaos"]')?.addEventListener("click", () => {
    scene.resetScenario(3);
    setLayoutUi(0);
    setWeatherUi(0);
    setTrafficUi(1.35);
    setDelayUi(3.2);
    setGatesUi(4);
    setSepUi(1.0);
    setReadbackUi(true);
    sim.triggerRushHour();
  });

  root.querySelector<HTMLButtonElement>('[data-scenario="storm-hub"]')?.addEventListener("click", () => {
    scene.resetScenario(3);
    setLayoutUi(2);
    setWeatherUi(2);
    setTrafficUi(1.85);
    setDelayUi(1.8);
    setGatesUi(6);
    setSepUi(1.25);
    setReadbackUi(true);
    sim.triggerRushHour();
  });

  root.querySelector<HTMLButtonElement>('[data-action="go-around"]')?.addEventListener("click", () => {
    sim.triggerGoAround();
  });
  root.querySelector<HTMLButtonElement>('[data-action="rush-hour"]')?.addEventListener("click", () => {
    sim.triggerRushHour();
  });
  root.querySelector<HTMLButtonElement>('[data-action="priority"]')?.addEventListener("click", () => {
    sim.triggerPriority();
  });
  root.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", () => {
    scene.resetScenario(3);
    setLayoutUi(0);
    setWeatherUi(0);
    setTrafficUi(1.05);
    setDelayUi(0.8);
    setGatesUi(4);
    setSepUi(1.0);
    setReadbackUi(false);
  });
}

export function initAllAtcWidgets(): void {
  document.querySelectorAll<HTMLElement>("[data-atc-mini]").forEach((el) => {
    void mountMiniScene(el);
  });
  document.querySelectorAll<HTMLElement>("[data-atc-sandbox]").forEach((el) => {
    void mountFlagshipSandbox(el);
  });
}
