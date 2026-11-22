//! Core aviation domain types, components, resources, and safety invariants.

use crate::ecs::Entity;

/// 3D world position in simulation metres (Y is altitude).
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn sub(self, other: Self) -> Self {
        Self::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    pub fn add(self, other: Self) -> Self {
        Self::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }

    pub fn scale(self, s: f32) -> Self {
        Self::new(self.x * s, self.y * s, self.z * s)
    }

    pub fn length(self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn dist_xz(self, other: Self) -> f32 {
        let dx = self.x - other.x;
        let dz = self.z - other.z;
        (dx * dx + dz * dz).sqrt()
    }

    pub fn dist(self, other: Self) -> f32 {
        self.sub(other).length()
    }
}

/// Aircraft physical transform in the 3D diorama.
#[derive(Debug, Clone, Copy)]
pub struct Transform {
    pub pos: Vec3,
    pub yaw: f32,
    pub pitch: f32,
    pub roll: f32,
}

/// Aircraft velocity & target cruising parameters.
#[derive(Debug, Clone, Copy)]
pub struct Kinematics {
    pub speed: f32,
    pub target_speed: f32,
    pub approach_speed: f32,
    pub taxi_speed: f32,
    pub takeoff_speed: f32,
    pub braking_decel: f32,
}

/// Distinct aircraft categories with realistic performance & wake differences.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AircraftKind {
    RegionalProp = 0,
    NarrowBody = 1,
    WideBody = 2,
}

impl AircraftKind {
    pub fn wake_separation_bonus(self) -> f32 {
        match self {
            Self::RegionalProp => 0.0,
            Self::NarrowBody => 2.5,
            Self::WideBody => 6.0,
        }
    }

    pub fn approach_speed(self) -> f32 {
        match self {
            Self::RegionalProp => 11.5,
            Self::NarrowBody => 13.5,
            Self::WideBody => 15.0,
        }
    }

    pub fn braking_decel(self) -> f32 {
        match self {
            Self::RegionalProp => 7.0,
            Self::NarrowBody => 5.6,
            Self::WideBody => 4.4,
        }
    }
}

/// Discrete aircraft flight phases — the backbone of the state machine.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FlightPhase {
    Approaching = 0,
    Holding = 1,
    Final = 2,
    Landing = 3,
    TaxiIn = 4,
    AtGate = 5,
    Pushback = 6,
    TaxiOut = 7,
    HoldShort = 8,
    LineUp = 9,
    Takeoff = 10,
    Climbing = 11,
    GoAround = 12,
}

impl FlightPhase {
    pub fn is_airborne(self) -> bool {
        matches!(
            self,
            Self::Approaching
                | Self::Holding
                | Self::Final
                | Self::Climbing
                | Self::GoAround
        )
    }

    pub fn occupies_runway(self) -> bool {
        matches!(self, Self::Landing | Self::LineUp | Self::Takeoff)
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Approaching => "APPROACH",
            Self::Holding => "HOLDING",
            Self::Final => "FINAL",
            Self::Landing => "LANDING",
            Self::TaxiIn => "TAXI IN",
            Self::AtGate => "AT GATE",
            Self::Pushback => "PUSHBACK",
            Self::TaxiOut => "TAXI OUT",
            Self::HoldShort => "HOLD SHORT",
            Self::LineUp => "LINE UP",
            Self::Takeoff => "TAKEOFF",
            Self::Climbing => "CLIMBING",
            Self::GoAround => "GO AROUND",
        }
    }
}

/// Identifying metadata for an aircraft entity.
#[derive(Debug, Clone)]
pub struct AircraftInfo {
    pub callsign: [u8; 8],
    pub callsign_len: u8,
    pub kind: AircraftKind,
    pub livery: u8,
    pub is_priority: bool,
}

impl AircraftInfo {
    pub fn new(callsign: &str, kind: AircraftKind, livery: u8, is_priority: bool) -> Self {
        let mut buf = [0u8; 8];
        let bytes = callsign.as_bytes();
        let len = bytes.len().min(8);
        buf[..len].copy_from_slice(&bytes[..len]);
        Self {
            callsign: buf,
            callsign_len: len as u8,
            kind,
            livery,
            is_priority,
        }
    }

    pub fn callsign_str(&self) -> &str {
        std::str::from_utf8(&self.callsign[..self.callsign_len as usize]).unwrap_or("UNKN")
    }
}

/// Flight plan & state-machine progress for a single aircraft.
#[derive(Debug, Clone)]
pub struct FlightState {
    pub phase: FlightPhase,
    pub assigned_runway: RunwayId,
    pub assigned_gate: Option<u8>,
    pub hold_angle: f32,
    pub hold_slot: u8,
    pub state_timer: f32,
    pub awaiting_clearance: bool,
    pub pending_ack: bool,
    pub clearance_seq: u32,
    pub waypoint_idx: usize,
    pub waypoints: Vec<Vec3>,
    pub fuel_remaining: f32,
    pub hold_time_total: f32,
    pub separation_warning: bool,
    pub nearest_dist: f32,
    pub go_around_count: u8,
}

/// Runway identifiers supported across the airfield layouts.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RunwayId {
    /// Main East-West runway (RWY 27)
    Rwy27 = 0,
    /// Second parallel East-West runway (RWY 27R, active in Parallel layout)
    Rwy27R = 1,
    /// Crosswind North-South runway (RWY 18, active in Intersecting layout)
    Rwy18 = 2,
}

impl RunwayId {
    pub fn index(self) -> usize {
        self as usize
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Rwy27 => "RWY 27",
            Self::Rwy27R => "RWY 27R",
            Self::Rwy18 => "RWY 18",
        }
    }
}

/// Configurable airfield geometry selectable in the flagship sandbox.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AirfieldLayout {
    SingleRunway = 0,
    ParallelRunways = 1,
    IntersectingRunways = 2,
}

impl AirfieldLayout {
    pub fn from_u8(v: u8) -> Self {
        match v {
            1 => Self::ParallelRunways,
            2 => Self::IntersectingRunways,
            _ => Self::SingleRunway,
        }
    }
}

/// Weather states that degrade braking, runway occupancy, and spacing.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Weather {
    Clear = 0,
    Rain = 1,
    Storm = 2,
}

impl Weather {
    pub fn from_u8(v: u8) -> Self {
        match v {
            1 => Self::Rain,
            2 => Self::Storm,
            _ => Self::Clear,
        }
    }

    /// Braking grip multiplier (< 1.0 means longer rollout & runway occupancy).
    pub fn braking_grip(self) -> f32 {
        match self {
            Self::Clear => 1.0,
            Self::Rain => 0.64,
            Self::Storm => 0.48,
        }
    }

    /// Spacing multiplier applied to ATC separation minima.
    pub fn separation_multiplier(self) -> f32 {
        match self {
            Self::Clear => 1.0,
            Self::Rain => 1.32,
            Self::Storm => 1.68,
        }
    }

    /// Extra taxi caution factor in wet/stormy weather.
    pub fn taxi_speed_multiplier(self) -> f32 {
        match self {
            Self::Clear => 1.0,
            Self::Rain => 0.82,
            Self::Storm => 0.68,
        }
    }
}

/// Explicit mutual-exclusion ownership of a runway.
///
/// Only one aircraft may hold a `RunwayLease` on a runway at any moment.
/// In the `IntersectingRunways` layout, RWY 27 and RWY 18 also share an
/// intersection mutex so crossing operations cannot overlap.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunwayPurpose {
    Landing,
    Takeoff,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RunwayLease {
    pub holder: Entity,
    pub purpose: RunwayPurpose,
    pub runway: RunwayId,
}

#[derive(Debug, Clone)]
pub struct RunwayLocks {
    leases: [Option<RunwayLease>; 3],
    wake_cooldown: [f32; 3],
}

impl Default for RunwayLocks {
    fn default() -> Self {
        Self {
            leases: [None; 3],
            wake_cooldown: [0.0; 3],
        }
    }
}

impl RunwayLocks {
    /// Attempts to acquire exclusive access to `runway`.
    /// Returns `Err(holder)` if the runway (or its crossing intersection) is busy.
    pub fn try_acquire(
        &mut self,
        layout: AirfieldLayout,
        runway: RunwayId,
        holder: Entity,
        purpose: RunwayPurpose,
    ) -> Result<RunwayLease, Option<Entity>> {
        let idx = runway.index();
        if let Some(existing) = self.leases[idx] {
            if existing.holder == holder {
                return Ok(existing);
            }
            return Err(Some(existing.holder));
        }
        if self.wake_cooldown[idx] > 0.0 {
            return Err(None);
        }

        // Cross-runway exclusion invariant: RWY 27 and RWY 18 intersect!
        if layout == AirfieldLayout::IntersectingRunways {
            let crossing = match runway {
                RunwayId::Rwy27 => Some(RunwayId::Rwy18),
                RunwayId::Rwy18 => Some(RunwayId::Rwy27),
                RunwayId::Rwy27R => None,
            };
            if let Some(other) = crossing {
                if let Some(existing) = self.leases[other.index()] {
                    return Err(Some(existing.holder));
                }
                if self.wake_cooldown[other.index()] > 0.0 {
                    return Err(None);
                }
            }
        }

        let lease = RunwayLease {
            holder,
            purpose,
            runway,
        };
        self.leases[idx] = Some(lease);
        Ok(lease)
    }

    /// Releases any runway lease held by `entity` and sets a wake-turbulence buffer.
    pub fn release_for(&mut self, entity: Entity, wake_seconds: f32) {
        for i in 0..3 {
            if let Some(lease) = self.leases[i] {
                if lease.holder == entity {
                    self.leases[i] = None;
                    self.wake_cooldown[i] = self.wake_cooldown[i].max(wake_seconds);
                }
            }
        }
    }

    pub fn holder(&self, runway: RunwayId) -> Option<RunwayLease> {
        self.leases[runway.index()]
    }

    pub fn wake_remaining(&self, runway: RunwayId) -> f32 {
        self.wake_cooldown[runway.index()]
    }

    pub fn is_busy(&self, runway: RunwayId) -> bool {
        self.leases[runway.index()].is_some()
    }

    pub fn tick_cooldowns(&mut self, dt: f32) {
        for cd in &mut self.wake_cooldown {
            if *cd > 0.0 {
                *cd = (*cd - dt).max(0.0);
            }
        }
    }

    pub fn active_count(&self) -> usize {
        self.leases.iter().filter(|l| l.is_some()).count()
    }

    pub fn clear(&mut self) {
        self.leases = [None; 3];
        self.wake_cooldown = [0.0; 3];
    }
}

/// Clearances & messages transmitted over the shared half-duplex radio channel.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RadioIntent {
    ClearedToLand(RunwayId),
    EnterHold,
    GoAround,
    ClearedTakeoff(RunwayId),
    TaxiToGate(u8),
    ReadbackOk,
    ReadbackGarbled,
    SayAgain,
    MaydayLowFuel,
}

#[derive(Debug, Clone)]
pub struct RadioTransmission {
    pub id: u32,
    pub target: Entity,
    pub from_tower: bool,
    pub intent: RadioIntent,
    pub clearance_seq: u32,
    pub total_delay: f32,
    pub elapsed: f32,
    pub is_urgent: bool,
    pub is_error: bool,
    pub delivered: bool,
}

/// Active visual radio pulse rendered as an expanding wave in Three.js.
#[derive(Debug, Clone, Copy)]
pub struct RadioPulse {
    pub from: Vec3,
    pub to: Vec3,
    pub progress: f32,
    pub kind: u8, // 0 = tower->plane, 1 = plane->tower, 2 = urgent/go-around, 3 = garbled/error
}

/// Structured radio transcript line exposed to the browser HUD.
#[derive(Debug, Clone)]
pub struct RadioLogEntry {
    pub timestamp: f32,
    pub speaker: String,
    pub text: String,
    pub severity: u8, // 0 = info, 1 = clearance, 2 = warn/error, 3 = urgent/go-around
}

/// Shared half-duplex radio frequency resource.
///
/// Only one message actively transmits at a time (or queues behind the active
/// transmission), modelling real-world VHF voice contention and latency.
#[derive(Debug, Clone, Default)]
pub struct RadioFrequency {
    pub queue: Vec<RadioTransmission>,
    pub active_pulses: Vec<RadioPulse>,
    pub log: Vec<RadioLogEntry>,
    pub next_id: u32,
}

impl RadioFrequency {
    pub fn enqueue(
        &mut self,
        target: Entity,
        from_tower: bool,
        intent: RadioIntent,
        clearance_seq: u32,
        delay: f32,
        is_urgent: bool,
        is_error: bool,
    ) {
        self.next_id += 1;
        let tx = RadioTransmission {
            id: self.next_id,
            target,
            from_tower,
            intent,
            clearance_seq,
            total_delay: delay.max(0.08),
            elapsed: 0.0,
            is_urgent,
            is_error,
            delivered: false,
        };
        if is_urgent && self.queue.len() > 1 {
            // Urgent instructions ("GO AROUND!") jump ahead of routine chatter.
            self.queue.insert(1, tx);
        } else {
            self.queue.push(tx);
        }
    }

    pub fn push_log(&mut self, timestamp: f32, speaker: &str, text: String, severity: u8) {
        self.log.push(RadioLogEntry {
            timestamp,
            speaker: speaker.to_string(),
            text,
            severity,
        });
        if self.log.len() > 28 {
            self.log.remove(0);
        }
    }

    pub fn has_pending_for(&self, target: Entity, from_tower: bool) -> bool {
        self.queue
            .iter()
            .any(|tx| !tx.delivered && tx.target == target && tx.from_tower == from_tower)
    }

    pub fn clear(&mut self) {
        self.queue.clear();
        self.active_pulses.clear();
        self.log.clear();
    }
}

/// Delivered radio message event consumed by pilot & tower systems.
#[derive(Debug, Clone, Copy)]
pub struct DeliveredMessage {
    pub target: Entity,
    pub from_tower: bool,
    pub intent: RadioIntent,
    pub clearance_seq: u32,
    pub is_error: bool,
}

/// Simulation scenario presets matching the progressive embeds + flagship sandbox.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScenarioPreset {
    /// Mini-scene 1: Calm, single runway, zero comms lag.
    HappyPath = 0,
    /// Mini-scene 2: Focused radio latency & readback race demo.
    RadioLag = 1,
    /// Mini-scene 3: Rainy weather & cascading holding queues.
    WeatherCascade = 2,
    /// Flagship sandbox: Full God-mode airport starting in balanced traffic.
    Flagship = 3,
}

impl ScenarioPreset {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => Self::HappyPath,
            1 => Self::RadioLag,
            2 => Self::WeatherCascade,
            _ => Self::Flagship,
        }
    }
}

/// User-controllable configuration resource.
#[derive(Debug, Clone)]
pub struct SimConfig {
    pub preset: ScenarioPreset,
    pub layout: AirfieldLayout,
    pub weather: Weather,
    /// Arrivals/departures spawn rate factor (0.2 = quiet, 1.0 = normal, 2.2 = rush hour).
    pub traffic_rate: f32,
    /// Base one-way radio transmission + reaction delay in seconds (0.0 .. 4.5).
    pub radio_delay: f32,
    /// Whether pilots occasionally mishear clearances and require a "Say again".
    pub readback_errors: bool,
    /// Number of active terminal gates (2 .. 6).
    pub active_gates: u8,
    /// Multiplier on required separation distance (0.75 = tight, 1.0 = standard, 1.4 = strict).
    pub separation_factor: f32,
}

impl SimConfig {
    pub fn for_preset(preset: ScenarioPreset) -> Self {
        match preset {
            ScenarioPreset::HappyPath => Self {
                preset,
                layout: AirfieldLayout::SingleRunway,
                weather: Weather::Clear,
                traffic_rate: 0.65,
                radio_delay: 0.15,
                readback_errors: false,
                active_gates: 4,
                separation_factor: 1.0,
            },
            ScenarioPreset::RadioLag => Self {
                preset,
                layout: AirfieldLayout::SingleRunway,
                weather: Weather::Clear,
                traffic_rate: 1.15,
                radio_delay: 2.2,
                readback_errors: true,
                active_gates: 4,
                separation_factor: 1.0,
            },
            ScenarioPreset::WeatherCascade => Self {
                preset,
                layout: AirfieldLayout::SingleRunway,
                weather: Weather::Rain,
                traffic_rate: 1.45,
                radio_delay: 0.9,
                readback_errors: false,
                active_gates: 4,
                separation_factor: 1.0,
            },
            ScenarioPreset::Flagship => Self {
                preset,
                layout: AirfieldLayout::SingleRunway,
                weather: Weather::Clear,
                traffic_rate: 1.05,
                radio_delay: 0.8,
                readback_errors: false,
                active_gates: 4,
                separation_factor: 1.0,
            },
        }
    }
}

/// Live telemetry metrics displayed in the HUD.
#[derive(Debug, Clone, Default)]
pub struct SimMetrics {
    pub sim_time: f32,
    pub total_landings: u32,
    pub total_takeoffs: u32,
    pub total_go_arounds: u32,
    pub total_separation_warnings: u32,
    pub total_readback_errors: u32,
    pub runway_busy_time: f32,
    pub completed_hold_time_sum: f32,
    pub completed_arrivals_count: u32,
    pub holding_count: u32,
    pub comms_queue_len: u32,
    pub active_aircraft: u32,
    pub conflict_flash_timer: f32,
}

impl SimMetrics {
    pub fn runway_utilization_pct(&self) -> f32 {
        if self.sim_time < 0.5 {
            0.0
        } else {
            ((self.runway_busy_time / self.sim_time) * 100.0).min(100.0)
        }
    }

    pub fn avg_hold_delay_secs(&self) -> f32 {
        if self.completed_arrivals_count == 0 {
            0.0
        } else {
            self.completed_hold_time_sum / (self.completed_arrivals_count as f32)
        }
    }
}
