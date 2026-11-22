//! Zero-dependency C-ABI WebAssembly interface for `atc-sim`.
//!
//! Supports multiple concurrent simulation instances on the same web page
//! (e.g. progressive mini-scenes + the final flagship sandbox) and exposes
//! flat `Float32Array`-compatible snapshots directly from WASM linear memory.

use std::cell::RefCell;

use crate::domain::{AirfieldLayout, RunwayId, RunwayPurpose, ScenarioPreset, Weather};
use crate::ecs::Schedule;
use crate::systems::World;

pub const HEADER_FLOATS: usize = 24;
pub const AIRCRAFT_FLOATS: usize = 16;
pub const PULSE_FLOATS: usize = 8;

pub struct SimInstance {
    pub world: World,
    pub schedule: Schedule<World>,
    pub snapshot_buf: Vec<f32>,
    pub log_buf: Vec<u8>,
}

impl SimInstance {
    pub fn new(preset: ScenarioPreset) -> Self {
        let mut inst = Self {
            world: World::new(preset),
            schedule: World::build_schedule(),
            snapshot_buf: Vec::with_capacity(512),
            log_buf: Vec::with_capacity(2048),
        };
        inst.rebuild_snapshot();
        inst
    }

    pub fn step(&mut self, dt: f32) {
        // Clamp dt to keep fixed-step kinematics stable across tab switches.
        let clamped = dt.clamp(0.0, 0.05);
        self.world.dt = clamped;
        self.schedule.run(&mut self.world);
        self.rebuild_snapshot();
    }

    pub fn rebuild_snapshot(&mut self) {
        let w = &self.world;
        let aircraft_count = w.entities.len();
        let pulse_count = w.radio.active_pulses.len();

        self.snapshot_buf.clear();
        self.snapshot_buf
            .reserve(HEADER_FLOATS + aircraft_count * AIRCRAFT_FLOATS + pulse_count * PULSE_FLOATS);

        let rwy_state = |rwy: RunwayId| -> f32 {
            if w.metrics.conflict_flash_timer > 0.0 && w.runway_locks.is_busy(rwy) {
                return 4.0;
            }
            if let Some(lease) = w.runway_locks.holder(rwy) {
                match lease.purpose {
                    RunwayPurpose::Landing => 1.0,
                    RunwayPurpose::Takeoff => 2.0,
                }
            } else if w.runway_locks.wake_remaining(rwy) > 0.0 {
                3.0
            } else {
                0.0
            }
        };

        let rwy_holder = |rwy: RunwayId| -> f32 {
            w.runway_locks
                .holder(rwy)
                .map(|l| l.holder.0 as f32)
                .unwrap_or(0.0)
        };

        // Header (24 floats)
        self.snapshot_buf.extend_from_slice(&[
            w.metrics.sim_time,
            aircraft_count as f32,
            pulse_count as f32,
            w.config.layout as u8 as f32,
            w.config.weather as u8 as f32,
            w.config.active_gates as f32,
            rwy_state(RunwayId::Rwy27),
            rwy_state(RunwayId::Rwy27R),
            rwy_state(RunwayId::Rwy18),
            w.metrics.total_landings as f32,
            w.metrics.total_takeoffs as f32,
            w.metrics.total_go_arounds as f32,
            w.metrics.total_separation_warnings as f32,
            w.metrics.runway_utilization_pct(),
            w.metrics.avg_hold_delay_secs(),
            w.metrics.holding_count as f32,
            w.metrics.comms_queue_len as f32,
            w.metrics.total_readback_errors as f32,
            w.metrics.conflict_flash_timer,
            rwy_holder(RunwayId::Rwy27),
            rwy_holder(RunwayId::Rwy27R),
            rwy_holder(RunwayId::Rwy18),
            w.config.radio_delay,
            w.config.traffic_rate,
        ]);

        // Aircraft records (16 floats each)
        for &entity in &w.entities {
            let Some(tr) = w.transforms.get(entity) else { continue };
            let Some(kin) = w.kinematics.get(entity) else { continue };
            let Some(info) = w.info.get(entity) else { continue };
            let Some(fs) = w.flight.get(entity) else { continue };

            let flags = (info.is_priority as u32)
                | ((fs.separation_warning as u32) << 1)
                | ((fs.awaiting_clearance as u32) << 2);

            let cs = &info.callsign;
            let cs_lo = (cs[0] as u32) | ((cs[1] as u32) << 8) | ((cs[2] as u32) << 16);
            let cs_hi = (cs[3] as u32) | ((cs[4] as u32) << 8) | ((cs[5] as u32) << 16);

            self.snapshot_buf.extend_from_slice(&[
                entity.0 as f32,
                tr.pos.x,
                tr.pos.y,
                tr.pos.z,
                tr.yaw,
                tr.pitch,
                tr.roll,
                kin.speed,
                fs.phase as u8 as f32,
                info.kind as u8 as f32,
                info.livery as f32,
                fs.assigned_runway as u8 as f32,
                flags as f32,
                fs.nearest_dist,
                cs_lo as f32,
                cs_hi as f32,
            ]);
        }

        // Radio pulses (8 floats each)
        for pulse in &w.radio.active_pulses {
            self.snapshot_buf.extend_from_slice(&[
                pulse.from.x,
                pulse.from.y,
                pulse.from.z,
                pulse.to.x,
                pulse.to.y,
                pulse.to.z,
                pulse.progress,
                pulse.kind as f32,
            ]);
        }

        // UTF-8 radio transcript log
        self.log_buf.clear();
        for entry in &w.radio.log {
            use std::fmt::Write;
            let mut line = String::with_capacity(64);
            let _ = writeln!(
                line,
                "{:.1}|{}|{}|{}",
                entry.timestamp, entry.severity, entry.speaker, entry.text
            );
            self.log_buf.extend_from_slice(line.as_bytes());
        }
    }
}

thread_local! {
    static INSTANCES: RefCell<Vec<Option<SimInstance>>> = const { RefCell::new(Vec::new()) };
}

fn with_instance<R>(handle: u32, f: impl FnOnce(&mut SimInstance) -> R) -> Option<R> {
    INSTANCES.with(|cell| {
        let mut list = cell.borrow_mut();
        let slot = list.get_mut(handle as usize)?.as_mut()?;
        Some(f(slot))
    })
}

#[no_mangle]
pub extern "C" fn sim_create(preset_id: u32) -> u32 {
    let preset = ScenarioPreset::from_u8(preset_id as u8);
    INSTANCES.with(|cell| {
        let mut list = cell.borrow_mut();
        for (idx, slot) in list.iter_mut().enumerate() {
            if slot.is_none() {
                *slot = Some(SimInstance::new(preset));
                return idx as u32;
            }
        }
        let idx = list.len() as u32;
        list.push(Some(SimInstance::new(preset)));
        idx
    })
}

#[no_mangle]
pub extern "C" fn sim_destroy(handle: u32) {
    INSTANCES.with(|cell| {
        let mut list = cell.borrow_mut();
        if let Some(slot) = list.get_mut(handle as usize) {
            *slot = None;
        }
    });
}

#[no_mangle]
pub extern "C" fn sim_reset(handle: u32, preset_id: u32) {
    let preset = ScenarioPreset::from_u8(preset_id as u8);
    with_instance(handle, |inst| {
        inst.world.reset(preset);
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_step(handle: u32, dt: f32) {
    with_instance(handle, |inst| inst.step(dt));
}

#[no_mangle]
pub extern "C" fn sim_snapshot_ptr(handle: u32) -> *const f32 {
    with_instance(handle, |inst| inst.snapshot_buf.as_ptr()).unwrap_or(std::ptr::null())
}

#[no_mangle]
pub extern "C" fn sim_snapshot_len(handle: u32) -> u32 {
    with_instance(handle, |inst| inst.snapshot_buf.len() as u32).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn sim_radio_log_ptr(handle: u32) -> *const u8 {
    with_instance(handle, |inst| inst.log_buf.as_ptr()).unwrap_or(std::ptr::null())
}

#[no_mangle]
pub extern "C" fn sim_radio_log_len(handle: u32) -> u32 {
    with_instance(handle, |inst| inst.log_buf.len() as u32).unwrap_or(0)
}

#[no_mangle]
pub extern "C" fn sim_set_weather(handle: u32, weather_id: u32) {
    let weather = Weather::from_u8(weather_id as u8);
    with_instance(handle, |inst| {
        if inst.world.config.weather != weather {
            inst.world.config.weather = weather;
            let msg = match weather {
                Weather::Clear => "ATIS: Skies clear, dry runway, braking action GOOD.",
                Weather::Rain => "ATIS: Moderate rain, wet runway, braking action FAIR.",
                Weather::Storm => "ATIS: Thunderstorm & gusts! Braking POOR, spacing widened.",
            };
            inst.world
                .radio
                .push_log(inst.world.metrics.sim_time, "ATIS", msg.into(), if weather == Weather::Clear { 0 } else { 2 });
            inst.rebuild_snapshot();
        }
    });
}

#[no_mangle]
pub extern "C" fn sim_set_traffic_rate(handle: u32, rate: f32) {
    with_instance(handle, |inst| {
        inst.world.config.traffic_rate = rate.clamp(0.15, 2.5);
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_set_radio_delay(handle: u32, delay_secs: f32) {
    with_instance(handle, |inst| {
        inst.world.config.radio_delay = delay_secs.clamp(0.0, 4.5);
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_set_readback_errors(handle: u32, enabled: u32) {
    with_instance(handle, |inst| {
        inst.world.config.readback_errors = enabled != 0;
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_set_layout(handle: u32, layout_id: u32) {
    let layout = AirfieldLayout::from_u8(layout_id as u8);
    with_instance(handle, |inst| {
        inst.world.set_layout(layout);
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_set_active_gates(handle: u32, gates: u32) {
    with_instance(handle, |inst| {
        inst.world.config.active_gates = (gates as u8).clamp(2, 6);
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_set_separation_factor(handle: u32, factor: f32) {
    with_instance(handle, |inst| {
        inst.world.config.separation_factor = factor.clamp(0.65, 1.6);
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_trigger_go_around(handle: u32) {
    with_instance(handle, |inst| {
        inst.world.trigger_go_around();
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_trigger_rush_hour(handle: u32) {
    with_instance(handle, |inst| {
        inst.world.trigger_rush_hour();
        inst.rebuild_snapshot();
    });
}

#[no_mangle]
pub extern "C" fn sim_trigger_priority(handle: u32) {
    with_instance(handle, |inst| {
        inst.world.trigger_priority_arrival();
        inst.rebuild_snapshot();
    });
}
