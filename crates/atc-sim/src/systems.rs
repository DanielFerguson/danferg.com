//! The ECS World and ordered systems driving the airport simulation.
//!
//! Each tick executes a deterministic Bevy-style schedule:
//! 1. `clock_and_spawner_system`  — advances time & spawns arrivals/departures
//! 2. `radio_channel_system`      — half-duplex VHF transmission queue & latency
//! 3. `atc_tower_system`          — runway mutex scheduling, spacing & go-arounds
//! 4. `pilot_fsm_system`          — processes clearances, readbacks & state changes
//! 5. `kinematics_system`         — 3D flight paths, weather braking & taxi queues
//! 6. `separation_monitor_system` — invariant verification, safety alerts & metrics

use std::f32::consts::PI;

use crate::airfield;
use crate::domain::{
    AircraftInfo, AircraftKind, AirfieldLayout, DeliveredMessage, FlightPhase, FlightState,
    Kinematics, RadioFrequency, RadioIntent, RadioPulse, RunwayId, RunwayLocks, RunwayPurpose,
    ScenarioPreset, SimConfig, SimMetrics, Transform, Vec3, Weather,
};
use crate::ecs::{ComponentStore, Entity, Events, Schedule, SimRng};

const AIRLINE_PREFIXES: [&str; 6] = ["QFA", "VOZ", "JST", "REX", "ANZ", "SIA"];

/// Complete ECS World holding component stores, resources, and event queues.
pub struct World {
    pub next_entity_id: u32,
    pub entities: Vec<Entity>,

    // Components
    pub transforms: ComponentStore<Transform>,
    pub kinematics: ComponentStore<Kinematics>,
    pub info: ComponentStore<AircraftInfo>,
    pub flight: ComponentStore<FlightState>,

    // Resources
    pub dt: f32,
    pub config: SimConfig,
    pub runway_locks: RunwayLocks,
    pub radio: RadioFrequency,
    pub metrics: SimMetrics,
    pub rng: SimRng,
    pub gate_occupants: [Option<Entity>; 6],
    pub spawn_timer: f32,
    pub spawn_counter: u32,
    pub callsign_counter: u32,

    // Double-buffered events
    pub delivered_radio: Events<DeliveredMessage>,
}

impl World {
    pub fn new(preset: ScenarioPreset) -> Self {
        let config = SimConfig::for_preset(preset);
        let seed = match preset {
            ScenarioPreset::HappyPath => 0x1010_2020_3030_4040,
            ScenarioPreset::RadioLag => 0xABCD_1234_5678_9EF0,
            ScenarioPreset::WeatherCascade => 0x7777_4242_8888_1337,
            ScenarioPreset::Flagship => 0xDEAD_BEEF_CAFE_BABE,
        };
        let mut world = Self {
            next_entity_id: 1,
            entities: Vec::new(),
            transforms: ComponentStore::default(),
            kinematics: ComponentStore::default(),
            info: ComponentStore::default(),
            flight: ComponentStore::default(),
            dt: 1.0 / 60.0,
            config,
            runway_locks: RunwayLocks::default(),
            radio: RadioFrequency::default(),
            metrics: SimMetrics::default(),
            rng: SimRng::new(seed),
            gate_occupants: [None; 6],
            spawn_timer: 1.5,
            spawn_counter: 0,
            callsign_counter: 10,
            delivered_radio: Events::default(),
        };
        world.seed_scenario(preset);
        world
    }

    pub fn build_schedule() -> Schedule<Self> {
        Schedule::default()
            .add_systems(clock_and_spawner_system)
            .add_systems(radio_channel_system)
            .add_systems(atc_tower_system)
            .add_systems(pilot_fsm_system)
            .add_systems(kinematics_system)
            .add_systems(separation_monitor_system)
    }

    pub fn reset(&mut self, preset: ScenarioPreset) {
        let mut fresh = Self::new(preset);
        fresh.config.layout = self.config.layout;
        // For non-flagship presets, reset to the preset's canonical defaults.
        if preset != ScenarioPreset::Flagship {
            fresh.config = SimConfig::for_preset(preset);
        } else {
            fresh.config = SimConfig::for_preset(ScenarioPreset::Flagship);
        }
        *self = fresh;
    }

    pub fn set_layout(&mut self, layout: AirfieldLayout) {
        if self.config.layout == layout {
            return;
        }
        self.config.layout = layout;
        // Reassign any airborne/holding aircraft targeting a disabled runway back to RWY 27.
        let ids: Vec<Entity> = self.entities.clone();
        for entity in ids {
            if let Some(fs) = self.flight.get_mut(entity) {
                let valid = match fs.assigned_runway {
                    RunwayId::Rwy27 => true,
                    RunwayId::Rwy27R => layout == AirfieldLayout::ParallelRunways,
                    RunwayId::Rwy18 => layout == AirfieldLayout::IntersectingRunways,
                };
                if !valid {
                    self.runway_locks.release_for(entity, 0.0);
                    fs.assigned_runway = RunwayId::Rwy27;
                    if fs.phase == FlightPhase::Final || fs.phase == FlightPhase::Landing {
                        fs.phase = FlightPhase::GoAround;
                        fs.waypoints = airfield::go_around_route(RunwayId::Rwy27, fs.hold_slot);
                        fs.waypoint_idx = 0;
                    } else if fs.phase == FlightPhase::TaxiOut || fs.phase == FlightPhase::HoldShort {
                        let gate = fs.assigned_gate.unwrap_or(0);
                        fs.phase = FlightPhase::TaxiOut;
                        fs.waypoints = airfield::taxi_out_route(gate, RunwayId::Rwy27);
                        fs.waypoint_idx = 0;
                    }
                }
            }
        }
        let label = match layout {
            AirfieldLayout::SingleRunway => "Single Runway (RWY 27)",
            AirfieldLayout::ParallelRunways => "Parallel Runways (RWY 27 / 27R)",
            AirfieldLayout::IntersectingRunways => "Intersecting Runways (RWY 27 + RWY 18)",
        };
        self.radio
            .push_log(self.metrics.sim_time, "SYS", format!("Airfield reconfigured: {label}"), 0);
    }

    fn seed_scenario(&mut self, preset: ScenarioPreset) {
        match preset {
            ScenarioPreset::HappyPath => {
                self.spawn_parked_aircraft(0, 2.5);
                self.spawn_parked_aircraft(2, 9.0);
                self.spawn_arrival(RunwayId::Rwy27, -14.0, false);
                self.radio.push_log(
                    0.0,
                    "TWR",
                    "Melbourne Tower active. RWY 27 clear, calm winds.".into(),
                    0,
                );
            }
            ScenarioPreset::RadioLag => {
                self.spawn_parked_aircraft(1, 0.5);
                self.spawn_arrival(RunwayId::Rwy27, -18.0, false);
                self.spawn_arrival(RunwayId::Rwy27, 4.0, false);
                self.radio.push_log(
                    0.0,
                    "TWR",
                    "VHF congested: 2.2s radio latency + readback errors enabled.".into(),
                    2,
                );
            }
            ScenarioPreset::WeatherCascade => {
                self.spawn_parked_aircraft(0, 1.5);
                self.spawn_parked_aircraft(2, 4.5);
                self.spawn_arrival(RunwayId::Rwy27, -16.0, false);
                self.spawn_arrival(RunwayId::Rwy27, 2.0, false);
                self.spawn_arrival(RunwayId::Rwy27, 18.0, false);
                self.radio.push_log(
                    0.0,
                    "TWR",
                    "ATIS: Wet runway, rain braking action FAIR. Expect holding.".into(),
                    2,
                );
            }
            ScenarioPreset::Flagship => {
                self.spawn_parked_aircraft(0, 1.8);
                self.spawn_parked_aircraft(2, 6.5);
                self.spawn_arrival(RunwayId::Rwy27, -16.0, false);
                self.spawn_arrival(RunwayId::Rwy27, 10.0, false);
                self.radio.push_log(
                    0.0,
                    "TWR",
                    "Tower online. All ECS invariants armed on RWY 27.".into(),
                    0,
                );
            }
        }
    }

    fn next_callsign(&mut self) -> (String, u8) {
        self.callsign_counter += 1;
        let idx = (self.callsign_counter as usize) % AIRLINE_PREFIXES.len();
        let num = 10 + ((self.callsign_counter * 17) % 89);
        (format!("{}{}", AIRLINE_PREFIXES[idx], num), idx as u8)
    }

    fn pick_kind(&mut self) -> AircraftKind {
        let r = self.rng.next_f32();
        if r < 0.34 {
            AircraftKind::RegionalProp
        } else if r < 0.78 {
            AircraftKind::NarrowBody
        } else {
            AircraftKind::WideBody
        }
    }

    pub fn allocate_hold_slot(&self, exclude: Entity) -> u8 {
        let mut used = [false; 6];
        for (e, fs) in self.flight.iter() {
            if e != exclude && matches!(fs.phase, FlightPhase::Holding | FlightPhase::GoAround) {
                let idx = (fs.hold_slot as usize).min(used.len() - 1);
                used[idx] = true;
            }
        }
        for (i, taken) in used.iter().enumerate() {
            if !taken {
                return i as u8;
            }
        }
        (self.spawn_counter % 6) as u8
    }

    pub fn free_gate(&self) -> Option<u8> {
        let limit = (self.config.active_gates as usize).clamp(2, 6);
        for i in 0..limit {
            if self.gate_occupants[i].is_none() {
                return Some(i as u8);
            }
        }
        None
    }

    fn reserve_gate(&mut self, gate: u8, entity: Entity) {
        if (gate as usize) < self.gate_occupants.len() {
            self.gate_occupants[gate as usize] = Some(entity);
        }
    }

    fn release_gate(&mut self, entity: Entity) {
        for slot in &mut self.gate_occupants {
            if *slot == Some(entity) {
                *slot = None;
            }
        }
    }

    pub fn spawn_arrival(&mut self, runway: RunwayId, offset_x: f32, is_priority: bool) -> Entity {
        let entity = Entity(self.next_entity_id);
        self.next_entity_id += 1;
        self.entities.push(entity);

        let (cs, livery) = self.next_callsign();
        let kind = if is_priority {
            AircraftKind::WideBody
        } else {
            self.pick_kind()
        };
        let pos = airfield::approach_spawn_pos(runway, offset_x);
        let target = airfield::final_approach_fix(runway);
        let yaw = (target.x - pos.x).atan2(target.z - pos.z);
        let approach_speed = kind.approach_speed();

        self.transforms.insert(
            entity,
            Transform {
                pos,
                yaw,
                pitch: -0.06,
                roll: 0.0,
            },
        );
        self.kinematics.insert(
            entity,
            Kinematics {
                speed: approach_speed,
                target_speed: approach_speed,
                approach_speed,
                taxi_speed: 6.2,
                takeoff_speed: approach_speed * 1.25,
                braking_decel: kind.braking_decel(),
            },
        );
        self.info
            .insert(entity, AircraftInfo::new(&cs, kind, livery, is_priority));

        let hold_slot = (self.spawn_counter % 4) as u8;
        self.spawn_counter += 1;
        self.flight.insert(
            entity,
            FlightState {
                phase: FlightPhase::Approaching,
                assigned_runway: runway,
                assigned_gate: None,
                hold_angle: (hold_slot as f32) * 1.4,
                hold_slot,
                state_timer: 0.0,
                awaiting_clearance: false,
                pending_ack: false,
                clearance_seq: 0,
                waypoint_idx: 0,
                waypoints: vec![target],
                fuel_remaining: if is_priority { 22.0 } else { 180.0 },
                hold_time_total: 0.0,
                separation_warning: false,
                nearest_dist: 99.0,
                go_around_count: 0,
            },
        );

        if is_priority {
            self.radio.push_log(
                self.metrics.sim_time,
                &cs,
                format!("PAN-PAN {cs}, low fuel! Request priority landing {}.", runway.label()),
                3,
            );
        }

        entity
    }

    pub fn spawn_parked_aircraft(&mut self, gate: u8, turnaround_secs: f32) -> Entity {
        let entity = Entity(self.next_entity_id);
        self.next_entity_id += 1;
        self.entities.push(entity);

        let (cs, livery) = self.next_callsign();
        let kind = self.pick_kind();
        let pos = airfield::gate_pos(gate);
        let approach_speed = kind.approach_speed();

        self.reserve_gate(gate, entity);
        self.transforms.insert(
            entity,
            Transform {
                pos,
                yaw: 0.0, // Nose facing south into terminal building
                pitch: 0.0,
                roll: 0.0,
            },
        );
        self.kinematics.insert(
            entity,
            Kinematics {
                speed: 0.0,
                target_speed: 0.0,
                approach_speed,
                taxi_speed: 6.2,
                takeoff_speed: approach_speed * 1.25,
                braking_decel: kind.braking_decel(),
            },
        );
        self.info
            .insert(entity, AircraftInfo::new(&cs, kind, livery, false));
        let dep_rwy = airfield::pick_departure_runway(self.config.layout);
        self.flight.insert(
            entity,
            FlightState {
                phase: FlightPhase::AtGate,
                assigned_runway: dep_rwy,
                assigned_gate: Some(gate),
                hold_angle: 0.0,
                hold_slot: 0,
                state_timer: turnaround_secs,
                awaiting_clearance: false,
                pending_ack: false,
                clearance_seq: 0,
                waypoint_idx: 0,
                waypoints: Vec::new(),
                fuel_remaining: 240.0,
                hold_time_total: 0.0,
                separation_warning: false,
                nearest_dist: 99.0,
                go_around_count: 0,
            },
        );
        entity
    }

    pub fn despawn(&mut self, entity: Entity) {
        self.runway_locks.release_for(entity, 1.5);
        self.release_gate(entity);
        self.transforms.remove(entity);
        self.kinematics.remove(entity);
        self.info.remove(entity);
        self.flight.remove(entity);
        self.entities.retain(|&e| e != entity);
    }

    /// Chaos action: force the aircraft closest to touchdown into a Go-Around.
    pub fn trigger_go_around(&mut self) {
        let mut best: Option<(Entity, f32)> = None;
        for (e, fs) in self.flight.iter() {
            if fs.phase == FlightPhase::Final || fs.phase == FlightPhase::Approaching {
                if let Some(tr) = self.transforms.get(e) {
                    let d = tr.pos.dist_xz(airfield::touchdown_pos(fs.assigned_runway));
                    if best.map(|(_, bd)| d < bd).unwrap_or(true) {
                        best = Some((e, d));
                    }
                }
            }
        }
        if let Some((target, _)) = best {
            let cs = self
                .info
                .get(target)
                .map(|i| i.callsign_str().to_string())
                .unwrap_or_else(|| "ACFT".into());
            let seq = self.flight.get(target).map(|f| f.clearance_seq + 1).unwrap_or(1);
            self.radio.enqueue(
                target,
                true,
                RadioIntent::GoAround,
                seq,
                (self.config.radio_delay * 0.45).max(0.2),
                true,
                false,
            );
            self.radio.push_log(
                self.metrics.sim_time,
                "TWR",
                format!("{cs}, GO AROUND! Runway hazard reported, climb & maintain holding."),
                3,
            );
            self.metrics.conflict_flash_timer = 1.6;
        }
    }

    /// Chaos action: inject a burst of 3 staggered arrivals.
    pub fn trigger_rush_hour(&mut self) {
        for i in 0..3 {
            if self.entities.len() >= 14 {
                break;
            }
            let rwy = airfield::pick_arrival_runway(self.config.layout, self.spawn_counter);
            self.spawn_arrival(rwy, (i as f32) * 14.0, false);
        }
        self.radio.push_log(
            self.metrics.sim_time,
            "APP",
            "Arrival bank inbound! 3 aircraft entering terminal area.".into(),
            2,
        );
    }

    /// Chaos action: inject a priority low-fuel wide-body arrival.
    pub fn trigger_priority_arrival(&mut self) {
        if self.entities.len() >= 15 {
            return;
        }
        let rwy = airfield::pick_arrival_runway(self.config.layout, self.spawn_counter);
        self.spawn_arrival(rwy, -8.0, true);
    }
}

/// System 1: Advances simulation time, wake cooldowns, and spawns new traffic.
pub fn clock_and_spawner_system(world: &mut World) {
    let dt = world.dt;
    world.metrics.sim_time += dt;
    world.runway_locks.tick_cooldowns(dt);

    if world.runway_locks.active_count() > 0 {
        world.metrics.runway_busy_time += dt;
    }
    if world.metrics.conflict_flash_timer > 0.0 {
        world.metrics.conflict_flash_timer = (world.metrics.conflict_flash_timer - dt).max(0.0);
    }

    // Dynamic spawn cadence scaled by traffic_rate.
    let rate = world.config.traffic_rate.clamp(0.15, 2.5);
    let max_aircraft = match world.config.preset {
        ScenarioPreset::HappyPath => 5,
        ScenarioPreset::RadioLag => 7,
        ScenarioPreset::WeatherCascade => 10,
        ScenarioPreset::Flagship => 14,
    };

    world.spawn_timer -= dt * rate;
    if world.spawn_timer <= 0.0 && world.entities.len() < max_aircraft {
        let airborne_arrivals = world
            .flight
            .iter()
            .filter(|(_, f)| {
                matches!(
                    f.phase,
                    FlightPhase::Approaching | FlightPhase::Holding | FlightPhase::Final
                )
            })
            .count();

        let rwy = airfield::pick_arrival_runway(world.config.layout, world.spawn_counter);
        // Ensure spawn point isn't right on top of another new arrival.
        let spawn_pt = airfield::approach_spawn_pos(rwy, 0.0);
        let clear_spawn = world
            .transforms
            .iter()
            .all(|(_, t)| t.pos.dist(spawn_pt) > 15.0);

        if clear_spawn && airborne_arrivals < 7 {
            world.spawn_arrival(rwy, 0.0, false);
            world.spawn_timer = world.rng.range_f32(5.5, 9.0);
        } else {
            world.spawn_timer = 1.5;
        }
    }
}

/// System 2: Half-duplex shared VHF radio channel with transmission latency & readback errors.
pub fn radio_channel_system(world: &mut World) {
    // Clear previous tick's delivered events so each transmission is consumed exactly once.
    world.delivered_radio.clear();
    world.radio.active_pulses.clear();

    let dt = world.dt;

    // Remove transmissions for despawned aircraft.
    world
        .radio
        .queue
        .retain(|tx| !tx.delivered && world.transforms.get(tx.target).is_some());

    // Half-duplex: only the front transmission actively occupies the frequency!
    // (When radio_delay is very small < 0.25s, messages zip through almost instantaneously.)
    if let Some(front) = world.radio.queue.first_mut() {
        front.elapsed += dt;
        let progress = (front.elapsed / front.total_delay).clamp(0.0, 1.0);

        if let Some(target_tr) = world.transforms.get(front.target) {
            let (from, to) = if front.from_tower {
                (airfield::TOWER_POS, target_tr.pos)
            } else {
                (target_tr.pos, airfield::TOWER_POS)
            };
            let kind = if front.is_error {
                3
            } else if front.is_urgent {
                2
            } else if front.from_tower {
                0
            } else {
                1
            };
            world.radio.active_pulses.push(RadioPulse {
                from,
                to,
                progress,
                kind,
            });
        }

        if front.elapsed >= front.total_delay {
            front.delivered = true;
            world.delivered_radio.send(DeliveredMessage {
                target: front.target,
                from_tower: front.from_tower,
                intent: front.intent,
                clearance_seq: front.clearance_seq,
                is_error: front.is_error,
            });
        }
    }

    world.radio.queue.retain(|tx| !tx.delivered);
    world.metrics.comms_queue_len = world.radio.queue.len() as u32;
}

/// System 3: ATC Tower Scheduler — enforces runway mutexes, spacing, and weather margins.
pub fn atc_tower_system(world: &mut World) {
    let weather = world.config.weather;
    let layout = world.config.layout;
    let delay = world.config.radio_delay;
    let sep_min = 17.5 * weather.separation_multiplier() * world.config.separation_factor;

    // 3a. Handle any readback errors returned by pilots ("Negative, say again!").
    let delivered: Vec<DeliveredMessage> = world.delivered_radio.read().copied().collect();
    for msg in delivered {
        if !msg.from_tower && msg.intent == RadioIntent::ReadbackGarbled {
            let cs = world
                .info
                .get(msg.target)
                .map(|i| i.callsign_str().to_string())
                .unwrap_or_else(|| "ACFT".into());
            world.metrics.total_readback_errors += 1;
            world.radio.push_log(
                world.metrics.sim_time,
                "TWR",
                format!("{cs}, negative readback! Say again & confirm clearance."),
                2,
            );
            world.radio.enqueue(
                msg.target,
                true,
                RadioIntent::SayAgain,
                msg.clearance_seq,
                (delay * 0.7).max(0.25),
                false,
                true,
            );
        }
    }

    // Snapshot candidate aircraft sorted by priority & proximity so decisions are deterministic.
    let mut arrivals: Vec<(Entity, FlightPhase, RunwayId, f32, bool, u8)> = Vec::new();
    let mut departures: Vec<(Entity, RunwayId, f32)> = Vec::new();

    for &entity in &world.entities {
        let Some(fs) = world.flight.get(entity) else { continue };
        let Some(tr) = world.transforms.get(entity) else { continue };
        let Some(info) = world.info.get(entity) else { continue };

        match fs.phase {
            FlightPhase::Approaching | FlightPhase::Holding => {
                let d = tr.pos.dist_xz(airfield::touchdown_pos(fs.assigned_runway));
                arrivals.push((
                    entity,
                    fs.phase,
                    fs.assigned_runway,
                    d,
                    info.is_priority,
                    fs.hold_slot,
                ));
            }
            FlightPhase::HoldShort => {
                departures.push((entity, fs.assigned_runway, fs.state_timer));
            }
            _ => {}
        }
    }

    // Priority aircraft first, then Holding aircraft that waited longest, then closest Approaching.
    arrivals.sort_by(|a, b| {
        b.4.cmp(&a.4)
            .then_with(|| (b.1 == FlightPhase::Holding).cmp(&(a.1 == FlightPhase::Holding)))
            .then_with(|| a.3.total_cmp(&b.3))
    });

    // 3b. Active safety check: if an aircraft is on short Final and the runway is STILL occupied
    // by another aircraft (classic radio-lag or wet-runway long-rollout race condition!), order GO AROUND!
    let final_entities: Vec<Entity> = world
        .entities
        .iter()
        .copied()
        .filter(|&e| world.flight.get(e).map(|f| f.phase == FlightPhase::Final).unwrap_or(false))
        .collect();

    for entity in final_entities {
        let (rwy, dist_to_td, seq) = {
            let fs = world.flight.get(entity).unwrap();
            let tr = world.transforms.get(entity).unwrap();
            (
                fs.assigned_runway,
                tr.pos.dist_xz(airfield::touchdown_pos(fs.assigned_runway)),
                fs.clearance_seq,
            )
        };

        let runway_stolen_or_blocked = match world.runway_locks.holder(rwy) {
            Some(lease) if lease.holder != entity => true,
            _ => {
                // Also check if another plane physically sits on the active runway!
                world.entities.iter().any(|&other| {
                    if other == entity {
                        return false;
                    }
                    let Some(ofs) = world.flight.get(other) else { return false };
                    ofs.assigned_runway == rwy && ofs.phase.occupies_runway()
                })
            }
        };

        // Also check intersection block on RWY 18 / RWY 27
        let crossing_blocked = layout == AirfieldLayout::IntersectingRunways && {
            let other_rwy = match rwy {
                RunwayId::Rwy27 => Some(RunwayId::Rwy18),
                RunwayId::Rwy18 => Some(RunwayId::Rwy27),
                RunwayId::Rwy27R => None,
            };
            other_rwy
                .and_then(|o| world.runway_locks.holder(o))
                .map(|l| l.holder != entity)
                .unwrap_or(false)
        };

        if (runway_stolen_or_blocked || crossing_blocked)
            && dist_to_td < 24.0
            && !world.radio.has_pending_for(entity, true)
        {
            let cs = world
                .info
                .get(entity)
                .map(|i| i.callsign_str().to_string())
                .unwrap_or_else(|| "ACFT".into());
            world.radio.enqueue(
                entity,
                true,
                RadioIntent::GoAround,
                seq + 1,
                (delay * 0.4).max(0.18),
                true,
                false,
            );
            world.radio.push_log(
                world.metrics.sim_time,
                "TWR",
                format!("{cs}, GO AROUND! {} still occupied!", rwy.label()),
                3,
            );
            world.metrics.conflict_flash_timer = 1.4;
        }
    }

    // 3c. Sequence arrivals onto Final or into the Holding Stack.
    for (entity, phase, rwy, dist_to_td, is_priority, _) in arrivals {
        if world.radio.has_pending_for(entity, true) {
            continue;
        }
        let awaiting = world
            .flight
            .get(entity)
            .map(|f| f.awaiting_clearance)
            .unwrap_or(false);
        if awaiting {
            continue;
        }

        // Only issue clearance once approaching aircraft reaches the approach gate (~62m).
        if phase == FlightPhase::Approaching && dist_to_td > 62.0 {
            continue;
        }

        // Check spacing behind any aircraft already on Final for the same runway.
        let my_pos = world.transforms.get(entity).unwrap().pos;
        let final_spaced = world.entities.iter().all(|&other| {
            if other == entity {
                return true;
            }
            let Some(ofs) = world.flight.get(other) else { return true };
            if ofs.phase != FlightPhase::Final && ofs.phase != FlightPhase::Landing {
                return true;
            }
            if ofs.assigned_runway != rwy {
                return true;
            }
            let Some(otr) = world.transforms.get(other) else { return true };
            let wake = world
                .info
                .get(other)
                .map(|i| i.kind.wake_separation_bonus())
                .unwrap_or(0.0);
            my_pos.dist_xz(otr.pos) > (sep_min + wake)
        });

        let has_free_gate = world.free_gate().is_some();
        let can_acquire = has_free_gate
            && final_spaced
            && world
                .runway_locks
                .try_acquire(layout, rwy, entity, RunwayPurpose::Landing)
                .is_ok();

        let cs = world
            .info
            .get(entity)
            .map(|i| i.callsign_str().to_string())
            .unwrap_or_else(|| "ACFT".into());

        if can_acquire {
            let seq = {
                let fs = world.flight.get_mut(entity).unwrap();
                fs.clearance_seq += 1;
                fs.awaiting_clearance = true;
                fs.clearance_seq
            };
            world.radio.enqueue(
                entity,
                true,
                RadioIntent::ClearedToLand(rwy),
                seq,
                delay.max(0.12),
                is_priority,
                false,
            );
            world.radio.push_log(
                world.metrics.sim_time,
                "TWR",
                format!("{cs}, cleared to land {}.", rwy.label()),
                1,
            );
        } else if phase == FlightPhase::Approaching && dist_to_td < 56.0 {
            // Cannot land yet — instruct aircraft to enter overhead holding stack!
            let seq = {
                let fs = world.flight.get_mut(entity).unwrap();
                fs.clearance_seq += 1;
                fs.awaiting_clearance = true;
                fs.clearance_seq
            };
            world.radio.enqueue(
                entity,
                true,
                RadioIntent::EnterHold,
                seq,
                (delay * 0.85).max(0.12),
                false,
                false,
            );
            world.radio.push_log(
                world.metrics.sim_time,
                "TWR",
                format!("{cs}, {} busy, enter holding stack.", rwy.label()),
                0,
            );
        }
    }

    // 3d. Clear waiting departures at Hold-Short bars when runway & final corridor are safe.
    departures.sort_by(|a, b| b.2.total_cmp(&a.2));
    for (entity, rwy, _) in departures {
        if world.radio.has_pending_for(entity, true) {
            continue;
        }
        let awaiting = world
            .flight
            .get(entity)
            .map(|f| f.awaiting_clearance)
            .unwrap_or(false);
        if awaiting {
            continue;
        }

        // Don't launch if an arrival is on short final (< 42m) on this runway (or crossing runway).
        let arrival_imminent = world.entities.iter().any(|&other| {
            let Some(ofs) = world.flight.get(other) else { return false };
            if ofs.phase != FlightPhase::Final {
                return false;
            }
            let same_or_cross = ofs.assigned_runway == rwy
                || (layout == AirfieldLayout::IntersectingRunways
                    && matches!(
                        (rwy, ofs.assigned_runway),
                        (RunwayId::Rwy27, RunwayId::Rwy18) | (RunwayId::Rwy18, RunwayId::Rwy27)
                    ));
            if !same_or_cross {
                return false;
            }
            let Some(otr) = world.transforms.get(other) else { return false };
            otr.pos.dist_xz(airfield::touchdown_pos(ofs.assigned_runway)) < 42.0
        });

        if arrival_imminent {
            continue;
        }

        if world
            .runway_locks
            .try_acquire(layout, rwy, entity, RunwayPurpose::Takeoff)
            .is_ok()
        {
            let cs = world
                .info
                .get(entity)
                .map(|i| i.callsign_str().to_string())
                .unwrap_or_else(|| "ACFT".into());
            let seq = {
                let fs = world.flight.get_mut(entity).unwrap();
                fs.clearance_seq += 1;
                fs.awaiting_clearance = true;
                fs.clearance_seq
            };
            world.radio.enqueue(
                entity,
                true,
                RadioIntent::ClearedTakeoff(rwy),
                seq,
                delay.max(0.12),
                false,
                false,
            );
            world.radio.push_log(
                world.metrics.sim_time,
                "TWR",
                format!("{cs}, line up & cleared for takeoff {}.", rwy.label()),
                1,
            );
        }
    }
}

/// System 4: Pilot State Machine — consumes delivered clearances, sends readbacks, and transitions phases.
pub fn pilot_fsm_system(world: &mut World) {
    let messages: Vec<DeliveredMessage> = world.delivered_radio.read().copied().collect();
    let delay = world.config.radio_delay;
    let readback_errors_enabled = world.config.readback_errors;

    for msg in messages {
        if !msg.from_tower {
            continue;
        }
        let entity = msg.target;
        let Some(current_phase) = world.flight.get(entity).map(|f| f.phase) else {
            continue;
        };
        let cs = world
            .info
            .get(entity)
            .map(|i| i.callsign_str().to_string())
            .unwrap_or_else(|| "ACFT".into());

        // Occasional readback garble when enabled (non-urgent messages only).
        let garble = readback_errors_enabled
            && !matches!(msg.intent, RadioIntent::GoAround | RadioIntent::SayAgain)
            && world.rng.next_f32() < 0.28;

        if garble {
            world.radio.push_log(
                world.metrics.sim_time,
                &cs,
                format!("...uh, {cs} copy... static, confirm runway?"),
                2,
            );
            world.radio.enqueue(
                entity,
                false,
                RadioIntent::ReadbackGarbled,
                msg.clearance_seq,
                (delay * 0.65).max(0.25),
                false,
                true,
            );
            continue;
        }

        match msg.intent {
            RadioIntent::SayAgain => {
                // Pilot finally got the corrected clearance — allow tower/pilot to resume.
                if let Some(fs) = world.flight.get_mut(entity) {
                    fs.awaiting_clearance = false;
                }
                world.radio.push_log(
                    world.metrics.sim_time,
                    &cs,
                    format!("Roger Tower, {cs} loud and clear now."),
                    0,
                );
            }
            RadioIntent::ClearedToLand(rwy) => {
                if matches!(current_phase, FlightPhase::Approaching | FlightPhase::Holding) {
                    let td = airfield::touchdown_pos(rwy);
                    let faf = airfield::final_approach_fix(rwy);
                    if let Some(fs) = world.flight.get_mut(entity) {
                        fs.phase = FlightPhase::Final;
                        fs.assigned_runway = rwy;
                        fs.awaiting_clearance = false;
                        fs.waypoints = vec![faf, td];
                        fs.waypoint_idx = 0;
                    }
                    world.radio.enqueue(
                        entity,
                        false,
                        RadioIntent::ReadbackOk,
                        msg.clearance_seq,
                        (delay * 0.55).max(0.15),
                        false,
                        false,
                    );
                    world.radio.push_log(
                        world.metrics.sim_time,
                        &cs,
                        format!("Cleared to land {}, {cs}.", rwy.label()),
                        0,
                    );
                }
            }
            RadioIntent::EnterHold => {
                if current_phase == FlightPhase::Approaching {
                    let slot = world.allocate_hold_slot(entity);
                    if let Some(fs) = world.flight.get_mut(entity) {
                        fs.phase = FlightPhase::Holding;
                        fs.hold_slot = slot;
                        fs.hold_angle = (slot as f32) * 1.15;
                        fs.awaiting_clearance = false;
                    }
                    world.radio.push_log(
                        world.metrics.sim_time,
                        &cs,
                        format!("Entering holding stack FL{}, {cs}.", 10 + (slot as u32) * 10),
                        0,
                    );
                }
            }
            RadioIntent::GoAround => {
                if matches!(
                    current_phase,
                    FlightPhase::Final | FlightPhase::Approaching | FlightPhase::Landing
                ) {
                    world.runway_locks.release_for(entity, 1.0);
                    let slot = world.allocate_hold_slot(entity);
                    let (rwy, slot) = {
                        let fs = world.flight.get_mut(entity).unwrap();
                        fs.phase = FlightPhase::GoAround;
                        fs.hold_slot = slot;
                        fs.awaiting_clearance = false;
                        fs.go_around_count += 1;
                        fs.waypoints = airfield::go_around_route(fs.assigned_runway, slot);
                        fs.waypoint_idx = 0;
                        (fs.assigned_runway, slot)
                    };
                    let _ = (rwy, slot);
                    world.metrics.total_go_arounds += 1;
                    world.radio.enqueue(
                        entity,
                        false,
                        RadioIntent::ReadbackOk,
                        msg.clearance_seq,
                        (delay * 0.4).max(0.15),
                        true,
                        false,
                    );
                    world.radio.push_log(
                        world.metrics.sim_time,
                        &cs,
                        format!("Going around! Climbing back to stack, {cs}."),
                        3,
                    );
                }
            }
            RadioIntent::ClearedTakeoff(rwy) => {
                if current_phase == FlightPhase::HoldShort {
                    if let Some(fs) = world.flight.get_mut(entity) {
                        fs.phase = FlightPhase::LineUp;
                        fs.assigned_runway = rwy;
                        fs.awaiting_clearance = false;
                        fs.waypoints = vec![airfield::lineup_pos(rwy)];
                        fs.waypoint_idx = 0;
                    }
                    world.radio.enqueue(
                        entity,
                        false,
                        RadioIntent::ReadbackOk,
                        msg.clearance_seq,
                        (delay * 0.5).max(0.15),
                        false,
                        false,
                    );
                    world.radio.push_log(
                        world.metrics.sim_time,
                        &cs,
                        format!("Cleared for takeoff {}, {cs}.", rwy.label()),
                        0,
                    );
                }
            }
            _ => {}
        }
    }

    // Autonomous ground timers (gate turnaround & pushback transitions).
    let ids: Vec<Entity> = world.entities.clone();
    let dt = world.dt;
    for entity in ids {
        let Some(phase) = world.flight.get(entity).map(|f| f.phase) else {
            continue;
        };
        match phase {
            FlightPhase::AtGate => {
                let ready = {
                    let fs = world.flight.get_mut(entity).unwrap();
                    fs.state_timer -= dt;
                    fs.state_timer <= 0.0
                };
                if ready {
                    let dep_rwy = airfield::pick_departure_runway(world.config.layout);
                    let gate = world.flight.get(entity).and_then(|f| f.assigned_gate).unwrap_or(0);
                    let push_pt = airfield::gate_pushback_pos(gate);
                    if let Some(fs) = world.flight.get_mut(entity) {
                        fs.phase = FlightPhase::Pushback;
                        fs.assigned_runway = dep_rwy;
                        fs.waypoints = vec![push_pt];
                        fs.waypoint_idx = 0;
                    }
                }
            }
            FlightPhase::Holding => {
                if let Some(fs) = world.flight.get_mut(entity) {
                    fs.hold_time_total += dt;
                    fs.fuel_remaining = (fs.fuel_remaining - dt).max(5.0);
                }
            }
            FlightPhase::HoldShort => {
                if let Some(fs) = world.flight.get_mut(entity) {
                    fs.state_timer += dt;
                }
            }
            _ => {}
        }
    }
}

/// System 5: 3D Kinematics, glideslope descent, weather-degraded braking, and taxi-queue spacing.
pub fn kinematics_system(world: &mut World) {
    let dt = world.dt;
    let weather = world.config.weather;
    let ids: Vec<Entity> = world.entities.clone();
    let mut to_despawn: Vec<Entity> = Vec::new();

    // Snapshot positions for ground taxi nose-to-tail spacing.
    let ground_positions: Vec<(Entity, Vec3, FlightPhase)> = world
        .entities
        .iter()
        .filter_map(|&e| {
            let tr = world.transforms.get(e)?;
            let fs = world.flight.get(e)?;
            if !fs.phase.is_airborne() {
                Some((e, tr.pos, fs.phase))
            } else {
                None
            }
        })
        .collect();

    for entity in ids {
        let Some(fs_clone) = world.flight.get(entity).cloned() else { continue };
        let Some(mut tr) = world.transforms.get(entity).copied() else { continue };
        let Some(mut kin) = world.kinematics.get(entity).copied() else { continue };

        match fs_clone.phase {
            FlightPhase::Holding => {
                let mut angle = fs_clone.hold_angle + dt * 0.58;
                if angle > PI * 2.0 {
                    angle -= PI * 2.0;
                }
                let target = airfield::holding_stack_pos(angle, fs_clone.hold_slot);
                let delta = target.sub(tr.pos);
                let desired_yaw = delta.x.atan2(delta.z);
                tr.yaw = lerp_angle(tr.yaw, desired_yaw, (dt * 4.5).min(1.0));
                tr.roll = lerp(tr.roll, -0.34, (dt * 3.0).min(1.0));
                tr.pitch = lerp(tr.pitch, 0.0, (dt * 3.0).min(1.0));
                let step = (kin.approach_speed * 0.92) * dt;
                let dist = delta.length();
                if dist > 0.01 {
                    tr.pos = tr.pos.add(delta.scale((step / dist).min(1.0)));
                }
                if let Some(fs) = world.flight.get_mut(entity) {
                    fs.hold_angle = angle;
                }
            }
            FlightPhase::Approaching | FlightPhase::Final => {
                let target = fs_clone
                    .waypoints
                    .get(fs_clone.waypoint_idx)
                    .copied()
                    .unwrap_or_else(|| airfield::touchdown_pos(fs_clone.assigned_runway));

                let delta = target.sub(tr.pos);
                let dist = delta.length();
                let desired_yaw = delta.x.atan2(delta.z);
                let yaw_diff = angle_diff(tr.yaw, desired_yaw);
                tr.yaw = lerp_angle(tr.yaw, desired_yaw, (dt * 3.6).min(1.0));
                tr.roll = lerp(tr.roll, (yaw_diff * 0.6).clamp(-0.42, 0.42), (dt * 4.0).min(1.0));

                let desired_pitch = if fs_clone.phase == FlightPhase::Final && tr.pos.y < 1.8 {
                    0.09 // Gentle landing flare!
                } else {
                    (delta.y / dist.max(1.0)).clamp(-0.22, 0.15)
                };
                tr.pitch = lerp(tr.pitch, desired_pitch, (dt * 4.0).min(1.0));

                let speed = if fs_clone.phase == FlightPhase::Final {
                    kin.approach_speed * 0.92
                } else {
                    kin.approach_speed
                };
                kin.speed = lerp(kin.speed, speed, (dt * 2.0).min(1.0));

                if dist > 0.01 {
                    tr.pos = tr.pos.add(delta.scale(((kin.speed * dt) / dist).min(1.0)));
                }

                if dist < 2.2 {
                    let next_idx = fs_clone.waypoint_idx + 1;
                    if next_idx < fs_clone.waypoints.len() {
                        if let Some(fs) = world.flight.get_mut(entity) {
                            fs.waypoint_idx = next_idx;
                        }
                    } else if fs_clone.phase == FlightPhase::Final {
                        // Touchdown! Transition to Landing rollout.
                        tr.pos.y = 0.0;
                        let exit = airfield::rollout_exit_pos(fs_clone.assigned_runway);
                        if let Some(fs) = world.flight.get_mut(entity) {
                            fs.phase = FlightPhase::Landing;
                            fs.waypoints = vec![exit];
                            fs.waypoint_idx = 0;
                        }
                        world.metrics.total_landings += 1;
                        world.metrics.completed_hold_time_sum += fs_clone.hold_time_total;
                        world.metrics.completed_arrivals_count += 1;
                    } else {
                        // Reached approach fix without clearance — automatically enter a free holding layer!
                        let slot = world.allocate_hold_slot(entity);
                        if let Some(fs) = world.flight.get_mut(entity) {
                            fs.phase = FlightPhase::Holding;
                            fs.hold_slot = slot;
                            fs.hold_angle = (slot as f32) * 1.15;
                            fs.awaiting_clearance = false;
                        }
                    }
                }
            }
            FlightPhase::Landing => {
                // Weather-degraded braking rollout! Wet/stormy runway stretches occupancy time.
                let exit = airfield::rollout_exit_pos(fs_clone.assigned_runway);
                let delta = exit.sub(tr.pos);
                let dist = delta.length();
                let desired_yaw = delta.x.atan2(delta.z);
                tr.yaw = lerp_angle(tr.yaw, desired_yaw, (dt * 6.0).min(1.0));
                tr.pitch = lerp(tr.pitch, 0.0, (dt * 6.0).min(1.0));
                tr.roll = lerp(tr.roll, 0.0, (dt * 6.0).min(1.0));
                tr.pos.y = 0.0;

                let min_rollout_speed = match weather {
                    Weather::Clear => 5.5,
                    Weather::Rain => 3.7,
                    Weather::Storm => 2.7,
                };
                let decel = kin.braking_decel * weather.braking_grip();
                kin.speed = (kin.speed - decel * dt).max(min_rollout_speed);

                if dist > 0.01 {
                    tr.pos = tr.pos.add(delta.scale(((kin.speed * dt) / dist).min(1.0)));
                }

                if dist < 2.0 {
                    // Vacated the runway! Release the runway mutex + apply wake turbulence cooldown.
                    let wake = match weather {
                        Weather::Clear => 1.8,
                        Weather::Rain => 3.2,
                        Weather::Storm => 4.8,
                    };
                    world.runway_locks.release_for(entity, wake);

                    let gate = world.free_gate().unwrap_or(0);
                    world.reserve_gate(gate, entity);
                    let route = airfield::taxi_in_route(fs_clone.assigned_runway, gate);
                    if let Some(fs) = world.flight.get_mut(entity) {
                        fs.phase = FlightPhase::TaxiIn;
                        fs.assigned_gate = Some(gate);
                        fs.waypoints = route;
                        fs.waypoint_idx = 0;
                    }
                }
            }
            FlightPhase::TaxiIn | FlightPhase::Pushback | FlightPhase::TaxiOut | FlightPhase::LineUp => {
                let target = fs_clone
                    .waypoints
                    .get(fs_clone.waypoint_idx)
                    .copied()
                    .unwrap_or(tr.pos);
                let delta = target.sub(tr.pos);
                let dist = delta.length();
                let desired_yaw = delta.x.atan2(delta.z);

                // Nose-to-tail taxiway collision avoidance (wait politely if a plane is right ahead).
                let mut blocked_ahead = false;
                if dist > 0.2 && fs_clone.phase != FlightPhase::Pushback {
                    let dir_x = delta.x / dist;
                    let dir_z = delta.z / dist;
                    for &(other, opos, ophase) in &ground_positions {
                        if other == entity || ophase == FlightPhase::AtGate {
                            continue;
                        }
                        let to_other = opos.sub(tr.pos);
                        let d = to_other.length();
                        if d < 6.8 && d > 0.01 {
                            let dot = (to_other.x * dir_x + to_other.z * dir_z) / d;
                            if dot > 0.55 {
                                blocked_ahead = true;
                                break;
                            }
                        }
                    }
                }

                let desired_speed = if blocked_ahead {
                    0.0
                } else if fs_clone.phase == FlightPhase::Pushback {
                    3.2
                } else {
                    kin.taxi_speed * weather.taxi_speed_multiplier()
                };
                kin.speed = lerp(kin.speed, desired_speed, (dt * 4.5).min(1.0));

                if fs_clone.phase != FlightPhase::Pushback && dist > 0.1 {
                    tr.yaw = lerp_angle(tr.yaw, desired_yaw, (dt * 6.5).min(1.0));
                }
                tr.pitch = 0.0;
                tr.roll = 0.0;
                tr.pos.y = 0.0;

                if dist > 0.01 && kin.speed > 0.01 {
                    tr.pos = tr.pos.add(delta.scale(((kin.speed * dt) / dist).min(1.0)));
                }

                if dist < 1.1 {
                    let next_idx = fs_clone.waypoint_idx + 1;
                    if next_idx < fs_clone.waypoints.len() {
                        if let Some(fs) = world.flight.get_mut(entity) {
                            fs.waypoint_idx = next_idx;
                        }
                    } else {
                        match fs_clone.phase {
                            FlightPhase::TaxiIn => {
                                tr.yaw = 0.0;
                                kin.speed = 0.0;
                                if let Some(fs) = world.flight.get_mut(entity) {
                                    fs.phase = FlightPhase::AtGate;
                                    fs.state_timer = world.rng.range_f32(5.5, 9.5);
                                }
                            }
                            FlightPhase::Pushback => {
                                let gate = fs_clone.assigned_gate.unwrap_or(0);
                                world.release_gate(entity);
                                let route = airfield::taxi_out_route(gate, fs_clone.assigned_runway);
                                if let Some(fs) = world.flight.get_mut(entity) {
                                    fs.phase = FlightPhase::TaxiOut;
                                    fs.assigned_gate = None;
                                    fs.waypoints = route;
                                    fs.waypoint_idx = 0;
                                }
                            }
                            FlightPhase::TaxiOut => {
                                kin.speed = 0.0;
                                if let Some(fs) = world.flight.get_mut(entity) {
                                    fs.phase = FlightPhase::HoldShort;
                                    fs.state_timer = 0.0;
                                    fs.awaiting_clearance = false;
                                }
                            }
                            FlightPhase::LineUp => {
                                // Aligned on runway threshold — spool engines & start takeoff roll!
                                let lift = airfield::liftoff_pos(fs_clone.assigned_runway);
                                let climb = airfield::climbout_pos(fs_clone.assigned_runway);
                                if let Some(fs) = world.flight.get_mut(entity) {
                                    fs.phase = FlightPhase::Takeoff;
                                    fs.waypoints = vec![lift, climb];
                                    fs.waypoint_idx = 0;
                                }
                                world.metrics.total_takeoffs += 1;
                            }
                            _ => {}
                        }
                    }
                }
            }
            FlightPhase::Takeoff | FlightPhase::Climbing => {
                let target = fs_clone
                    .waypoints
                    .get(fs_clone.waypoint_idx)
                    .copied()
                    .unwrap_or_else(|| airfield::climbout_pos(fs_clone.assigned_runway));
                let delta = target.sub(tr.pos);
                let dist = delta.length();
                let desired_yaw = delta.x.atan2(delta.z);
                tr.yaw = lerp_angle(tr.yaw, desired_yaw, (dt * 5.0).min(1.0));
                tr.roll = lerp(tr.roll, 0.0, (dt * 3.0).min(1.0));

                if fs_clone.phase == FlightPhase::Takeoff {
                    kin.speed = (kin.speed + 7.5 * dt).min(kin.takeoff_speed);
                    tr.pitch = lerp(tr.pitch, if dist < 8.0 { 0.14 } else { 0.0 }, (dt * 4.0).min(1.0));
                } else {
                    kin.speed = lerp(kin.speed, kin.takeoff_speed * 1.15, (dt * 2.0).min(1.0));
                    tr.pitch = lerp(tr.pitch, 0.24, (dt * 3.0).min(1.0));
                }

                if dist > 0.01 {
                    tr.pos = tr.pos.add(delta.scale(((kin.speed * dt) / dist).min(1.0)));
                }

                if dist < 2.5 {
                    let next_idx = fs_clone.waypoint_idx + 1;
                    if next_idx < fs_clone.waypoints.len() {
                        if let Some(fs) = world.flight.get_mut(entity) {
                            fs.waypoint_idx = next_idx;
                            fs.phase = FlightPhase::Climbing;
                        }
                        // Airborne & clear of runway — release mutex with wake buffer!
                        let wake = match weather {
                            Weather::Clear => 2.2,
                            Weather::Rain => 3.5,
                            Weather::Storm => 5.0,
                        };
                        world.runway_locks.release_for(entity, wake);
                    } else {
                        to_despawn.push(entity);
                    }
                }
            }
            FlightPhase::GoAround => {
                let target = fs_clone
                    .waypoints
                    .get(fs_clone.waypoint_idx)
                    .copied()
                    .unwrap_or_else(|| airfield::holding_stack_pos(0.0, fs_clone.hold_slot));
                let delta = target.sub(tr.pos);
                let dist = delta.length();
                let desired_yaw = delta.x.atan2(delta.z);
                let yaw_diff = angle_diff(tr.yaw, desired_yaw);
                tr.yaw = lerp_angle(tr.yaw, desired_yaw, (dt * 3.8).min(1.0));
                tr.roll = lerp(tr.roll, (yaw_diff * 0.65).clamp(-0.45, 0.45), (dt * 4.0).min(1.0));
                tr.pitch = lerp(tr.pitch, 0.22, (dt * 3.5).min(1.0));
                kin.speed = lerp(kin.speed, kin.approach_speed * 1.12, (dt * 3.0).min(1.0));

                if dist > 0.01 {
                    tr.pos = tr.pos.add(delta.scale(((kin.speed * dt) / dist).min(1.0)));
                }

                if dist < 3.0 {
                    let next_idx = fs_clone.waypoint_idx + 1;
                    if next_idx < fs_clone.waypoints.len() {
                        if let Some(fs) = world.flight.get_mut(entity) {
                            fs.waypoint_idx = next_idx;
                        }
                    } else if let Some(fs) = world.flight.get_mut(entity) {
                        fs.phase = FlightPhase::Holding;
                        fs.hold_angle = PI;
                        fs.awaiting_clearance = false;
                    }
                }
            }
            FlightPhase::AtGate | FlightPhase::HoldShort => {
                kin.speed = 0.0;
                tr.pitch = 0.0;
                tr.roll = 0.0;
            }
        }

        world.transforms.insert(entity, tr);
        world.kinematics.insert(entity, kin);
    }

    for entity in to_despawn {
        world.despawn(entity);
    }
}

/// System 6: Pairwise separation monitor, TCAS safeguard, and live metrics.
///
/// Mirrors real-world ATC separation minima: two airborne aircraft are safely
/// separated if they maintain EITHER horizontal spacing OR vertical separation
/// (RVSM altitude layers in the holding stack).
pub fn separation_monitor_system(world: &mut World) {
    let sep_horiz_min = 9.5 * world.config.separation_factor;
    let sep_vert_min = 2.5;
    let ids: Vec<Entity> = world.entities.clone();

    let mut holding_count = 0u32;
    let mut active_warnings: Vec<Entity> = Vec::new();

    for &e in &ids {
        let Some(fs) = world.flight.get(e) else { continue };
        if fs.phase == FlightPhase::Holding {
            holding_count += 1;
        }
        let Some(tr) = world.transforms.get(e) else { continue };

        let mut nearest = 999.0f32;
        let mut conflict = false;
        for &other in &ids {
            if other == e {
                continue;
            }
            let Some(otr) = world.transforms.get(other) else { continue };
            let Some(ofs) = world.flight.get(other) else { continue };
            if fs.phase.is_airborne() && ofs.phase.is_airborne() {
                let d_horiz = tr.pos.dist_xz(otr.pos);
                let d_vert = (tr.pos.y - otr.pos.y).abs();
                let d_3d = tr.pos.dist(otr.pos);
                if d_3d < nearest {
                    nearest = d_3d;
                }
                if d_horiz < sep_horiz_min && d_vert < sep_vert_min {
                    conflict = true;
                }
            }
        }

        let warned = fs.phase.is_airborne() && conflict;
        let was_warned = fs.separation_warning;
        if let Some(fs_mut) = world.flight.get_mut(e) {
            fs_mut.nearest_dist = nearest.min(99.9);
            fs_mut.separation_warning = warned;
        }
        if warned && !was_warned {
            world.metrics.total_separation_warnings += 1;
            world.metrics.conflict_flash_timer = world.metrics.conflict_flash_timer.max(1.0);
            active_warnings.push(e);
        }
    }

    // If two aircraft on Final compress critically, trigger automatic TCAS go-around for the trailing one.
    for entity in active_warnings {
        let is_final = world
            .flight
            .get(entity)
            .map(|f| f.phase == FlightPhase::Final)
            .unwrap_or(false);
        if is_final && !world.radio.has_pending_for(entity, true) {
            let cs = world
                .info
                .get(entity)
                .map(|i| i.callsign_str().to_string())
                .unwrap_or_else(|| "ACFT".into());
            let seq = world.flight.get(entity).map(|f| f.clearance_seq + 1).unwrap_or(1);
            world.radio.enqueue(
                entity,
                true,
                RadioIntent::GoAround,
                seq,
                (world.config.radio_delay * 0.35).max(0.15),
                true,
                false,
            );
            world.radio.push_log(
                world.metrics.sim_time,
                "TCAS",
                format!("{cs}, LOSS OF SEPARATION, climb & go around!"),
                3,
            );
        }
    }

    world.metrics.holding_count = holding_count;
    world.metrics.active_aircraft = world.entities.len() as u32;
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

fn angle_diff(from: f32, to: f32) -> f32 {
    let mut d = (to - from) % (2.0 * PI);
    if d > PI {
        d -= 2.0 * PI;
    } else if d < -PI {
        d += 2.0 * PI;
    }
    d
}

fn lerp_angle(from: f32, to: f32, t: f32) -> f32 {
    from + angle_diff(from, to) * t
}
