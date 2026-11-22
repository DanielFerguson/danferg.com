import { mountCanvasLoop } from "./webgl-utils";

interface Beacon {
  x: number;
  y: number;
  label: string;
  ping: number;
  userCreated?: boolean;
}

interface Agent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  targetIdx: number;
  hueMix: number;
  trail: Array<[number, number]>;
}

const LABELS = ["MEL", "SNK", "SPT", "CIV", "AI-1", "SYS", "WPT"];

export function mountVectorWaypoints(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const beacons: Beacon[] = [
    { x: 0.24, y: 0.30, label: "MEL", ping: 0 },
    { x: 0.75, y: 0.28, label: "SPT", ping: 0 },
    { x: 0.52, y: 0.55, label: "CIV", ping: 0 },
    { x: 0.28, y: 0.74, label: "SNK", ping: 0 },
    { x: 0.74, y: 0.74, label: "SYS", ping: 0 },
  ];

  const agents: Agent[] = Array.from({ length: 16 }, (_, i) => {
    const start = beacons[i % beacons.length];
    const angle = (i / 16) * Math.PI * 2;
    const speed = 0.085 + (i % 5) * 0.014;
    return {
      x: start.x + Math.cos(angle) * 0.08,
      y: start.y + Math.sin(angle) * 0.08,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      targetIdx: (i + 1) % beacons.length,
      hueMix: (i % 6) / 5,
      trail: [],
    };
  });

  let userBeaconCounter = 1;

  const disposeLoop = mountCanvasLoop(
    canvas,
    (nx, ny) => {
      // Canvas2D uses top-left origin; pointerCoords returns bottom-left y
      const y = 1 - ny;
      const userBeacons = beacons.filter((b) => b.userCreated);
      if (userBeacons.length >= 4) {
        const oldestIdx = beacons.findIndex((b) => b.userCreated);
        if (oldestIdx >= 0) beacons.splice(oldestIdx, 1);
      }
      const newIdx = beacons.length;
      beacons.push({
        x: nx,
        y,
        label: `W${String(userBeaconCounter++).padStart(2, "0")}`,
        ping: 1.0,
        userCreated: true,
      });
      // Immediately route several nearby agents through the new waypoint
      agents.forEach((agent, idx) => {
        if (idx % 3 === 0) agent.targetIdx = newIdx;
      });
    },
    (state, dt) => {
      const w = state.width;
      const h = state.height;
      const dpr = state.dpr;
      const dark = state.theme > 0.5;
      const ptrX = state.pointer[0];
      const ptrY = 1 - state.pointer[1];

      // Background
      ctx.fillStyle = dark ? "#121022" : "#faf8ff";
      ctx.fillRect(0, 0, w, h);

      // Subtle radial glow
      const bgGrad = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        0,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.65,
      );
      if (dark) {
        bgGrad.addColorStop(0, "rgba(79, 57, 246, 0.16)");
        bgGrad.addColorStop(0.6, "rgba(204, 102, 255, 0.06)");
        bgGrad.addColorStop(1, "rgba(18, 16, 34, 0)");
      } else {
        bgGrad.addColorStop(0, "rgba(204, 102, 255, 0.10)");
        bgGrad.addColorStop(0.55, "rgba(79, 57, 246, 0.05)");
        bgGrad.addColorStop(1, "rgba(250, 248, 255, 0)");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Architectural grid
      const step = 44 * dpr;
      ctx.strokeStyle = dark
        ? "rgba(210, 190, 255, 0.07)"
        : "rgba(79, 57, 246, 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = step; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Subtle concentric radar range rings + gentle sweep
      const cx = w * 0.5;
      const cy = h * 0.5;
      const maxR = Math.min(w, h) * 0.44;
      ctx.strokeStyle = dark
        ? "rgba(210, 190, 255, 0.09)"
        : "rgba(79, 57, 246, 0.09)";
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxR * r) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      const sweepAngle = state.time * 0.45;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);
      const sweepGrad = ctx.createLinearGradient(0, 0, maxR, 0);
      sweepGrad.addColorStop(
        0,
        dark ? "rgba(204, 102, 255, 0.24)" : "rgba(79, 57, 246, 0.18)",
      );
      sweepGrad.addColorStop(1, "rgba(204, 102, 255, 0)");
      ctx.strokeStyle = sweepGrad;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxR, 0);
      ctx.stroke();
      ctx.restore();

      // Faint route network lines between beacons
      ctx.strokeStyle = dark
        ? "rgba(180, 160, 255, 0.12)"
        : "rgba(79, 57, 246, 0.10)";
      ctx.setLineDash([4 * dpr, 5 * dpr]);
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      for (let i = 0; i < beacons.length; i++) {
        const a = beacons[i];
        const b = beacons[(i + 1) % beacons.length];
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Update & draw agents
      const aspect = w / h;
      for (const agent of agents) {
        if (agent.targetIdx >= beacons.length) {
          agent.targetIdx = 0;
        }
        const target = beacons[agent.targetIdx];
        const dx = target.x - agent.x;
        const dy = target.y - agent.y;
        const dist = Math.hypot(dx * aspect, dy);

        if (dist < 0.035) {
          target.ping = 1.0;
          let next = Math.floor(Math.random() * beacons.length);
          if (next === agent.targetIdx) next = (next + 1) % beacons.length;
          agent.targetIdx = next;
        }

        // Smooth desired steering velocity
        const norm = Math.hypot(dx, dy) + 0.0001;
        let desX = (dx / norm) * agent.speed;
        let desY = (dy / norm) * agent.speed;

        // Cursor smoothly deflects & guides nearby vector paths
        if (state.hover > 0.05) {
          const pdx = (agent.x - ptrX) * aspect;
          const pdy = agent.y - ptrY;
          const pdist = Math.hypot(pdx, pdy) + 0.0001;
          if (pdist < 0.24) {
            const strength = (1 - pdist / 0.24) * state.hover * 0.24;
            // Smooth tangential curve around pointer
            const tx = -pdy / pdist;
            const ty = pdx / pdist;
            desX += (pdx / pdist / aspect + tx * 0.9 / aspect) * strength;
            desY += (pdy / pdist + ty * 0.9) * strength;
          }
        }

        agent.vx += (desX - agent.vx) * Math.min(1, dt * 3.4);
        agent.vy += (desY - agent.vy) * Math.min(1, dt * 3.4);
        const curSpd = Math.hypot(agent.vx, agent.vy) + 0.0001;
        agent.vx = (agent.vx / curSpd) * agent.speed;
        agent.vy = (agent.vy / curSpd) * agent.speed;

        agent.x += (agent.vx / aspect) * dt;
        agent.y += agent.vy * dt;

        agent.trail.push([agent.x * w, agent.y * h]);
        if (agent.trail.length > 26) agent.trail.shift();

        // Draw luminous gradient trail
        if (agent.trail.length > 2) {
          const first = agent.trail[0];
          const last = agent.trail[agent.trail.length - 1];
          const grad = ctx.createLinearGradient(
            first[0],
            first[1],
            last[0],
            last[1],
          );
          const endColor =
            agent.hueMix > 0.55
              ? dark
                ? "rgba(232, 152, 255, 0.92)"
                : "rgba(196, 86, 255, 0.88)"
              : dark
                ? "rgba(140, 122, 255, 0.92)"
                : "rgba(79, 57, 246, 0.85)";
          grad.addColorStop(0, "rgba(79, 57, 246, 0)");
          grad.addColorStop(1, endColor);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2 * dpr;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(first[0], first[1]);
          for (let j = 1; j < agent.trail.length; j++) {
            ctx.lineTo(agent.trail[j][0], agent.trail[j][1]);
          }
          ctx.stroke();
        }

        // Draw crisp directional chevron arrowhead
        const heading = Math.atan2(agent.vy, agent.vx / aspect);
        const ax = agent.x * w;
        const ay = agent.y * h;
        const sz = 4.6 * dpr;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(heading);
        ctx.fillStyle =
          agent.hueMix > 0.55
            ? dark
              ? "#f0b5ff"
              : "#b94fff"
            : dark
              ? "#b5a6ff"
              : "#4f39f6";
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(-sz * 0.8, -sz * 0.62);
        ctx.lineTo(-sz * 0.35, 0);
        ctx.lineTo(-sz * 0.8, sz * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw beacons & arrival pings
      ctx.font = `500 ${10 * dpr}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textBaseline = "middle";
      for (const beacon of beacons) {
        beacon.ping = Math.max(0, beacon.ping - dt * 1.35);
        const bx = beacon.x * w;
        const by = beacon.y * h;

        if (beacon.ping > 0.01) {
          const pr = (1 - beacon.ping) * 32 * dpr + 6 * dpr;
          ctx.strokeStyle = beacon.userCreated
            ? `rgba(204, 102, 255, ${beacon.ping * 0.85})`
            : `rgba(79, 57, 246, ${beacon.ping * 0.7})`;
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.arc(bx, by, pr, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Outer ring
        ctx.fillStyle = dark ? "#121022" : "#ffffff";
        ctx.strokeStyle = beacon.userCreated
          ? "#cc66ff"
          : dark
            ? "#a997ff"
            : "#4f39f6";
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(bx, by, 5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner dot
        ctx.fillStyle = beacon.userCreated
          ? "#cc66ff"
          : dark
            ? "#e6a3ff"
            : "#4f39f6";
        ctx.beginPath();
        ctx.arc(bx, by, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Coordinate label
        ctx.fillStyle = dark
          ? "rgba(220, 210, 255, 0.72)"
          : "rgba(50, 40, 90, 0.65)";
        ctx.fillText(beacon.label, bx + 9 * dpr, by);
      }

      // Pointer deflection halo
      if (state.hover > 0.02) {
        const px = ptrX * w;
        const py = ptrY * h;
        ctx.strokeStyle = dark
          ? `rgba(230, 163, 255, ${state.hover * 0.45})`
          : `rgba(79, 57, 246, ${state.hover * 0.35})`;
        ctx.setLineDash([3 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.arc(px, py, 24 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
  );

  return disposeLoop;
}

export const _unusedLabels = LABELS;
