//! Parametric airfield geometry, runway definitions, taxiway routing, and holding stacks.

use crate::domain::{AirfieldLayout, RunwayId, Vec3};

pub const TOWER_POS: Vec3 = Vec3::new(-12.0, 9.5, 23.5);
pub const TAXIWAY_Z: f32 = 13.0;
pub const GATE_Z: f32 = 22.5;
pub const RWY27_Z: f32 = 0.0;
pub const RWY27R_Z: f32 = -16.0;
pub const RWY18_X: f32 = -22.0;

/// Up to 6 terminal gate X-coordinates along the south apron.
pub const GATE_X: [f32; 6] = [-4.0, 2.5, 9.0, 15.5, 22.0, 28.5];

/// Returns the world position for terminal gate `idx` (0..6).
pub fn gate_pos(idx: u8) -> Vec3 {
    let x = GATE_X[(idx as usize).min(GATE_X.len() - 1)];
    Vec3::new(x, 0.0, GATE_Z)
}

/// Pushback point on the apron before joining Taxiway Alpha.
pub fn gate_pushback_pos(idx: u8) -> Vec3 {
    let x = GATE_X[(idx as usize).min(GATE_X.len() - 1)];
    Vec3::new(x, 0.0, TAXIWAY_Z + 2.6)
}

/// Entry/exit point on Taxiway Alpha aligned with a gate.
pub fn gate_taxi_pos(idx: u8) -> Vec3 {
    let x = GATE_X[(idx as usize).min(GATE_X.len() - 1)];
    Vec3::new(x, 0.0, TAXIWAY_Z)
}

/// Holding stack position for a given angle (radians) and altitude slot (0..6).
pub fn holding_stack_pos(angle: f32, slot: u8) -> Vec3 {
    let cx = 24.0;
    let cz = -20.0;
    let rx = 14.5;
    let rz = 8.5;
    let alt = 11.5 + (slot.min(5) as f32) * 3.2;
    Vec3::new(cx + angle.cos() * rx, alt, cz + angle.sin() * rz)
}

/// Starting approach waypoint for an arriving aircraft.
pub fn approach_spawn_pos(runway: RunwayId, offset_x: f32) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(76.0 + offset_x, 12.5, RWY27_Z),
        RunwayId::Rwy27R => Vec3::new(76.0 + offset_x, 12.5, RWY27R_Z),
        RunwayId::Rwy18 => Vec3::new(RWY18_X, 12.5, -72.0 - offset_x),
    }
}

/// Final approach fix (where ATC must grant landing clearance or send to hold).
pub fn final_approach_fix(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(52.0, 6.2, RWY27_Z),
        RunwayId::Rwy27R => Vec3::new(52.0, 6.2, RWY27R_Z),
        RunwayId::Rwy18 => Vec3::new(RWY18_X, 6.2, -50.0),
    }
}

/// Touchdown threshold target for a runway.
pub fn touchdown_pos(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(26.0, 0.0, RWY27_Z),
        RunwayId::Rwy27R => Vec3::new(26.0, 0.0, RWY27R_Z),
        RunwayId::Rwy18 => Vec3::new(RWY18_X, 0.0, -24.0),
    }
}

/// End of landing rollout where the aircraft vacates the runway.
pub fn rollout_exit_pos(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(-28.0, 0.0, RWY27_Z),
        RunwayId::Rwy27R => Vec3::new(-32.0, 0.0, RWY27R_Z),
        RunwayId::Rwy18 => Vec3::new(RWY18_X, 0.0, 13.0),
    }
}

/// Builds the landing-to-gate taxiway route after vacating `runway`.
pub fn taxi_in_route(runway: RunwayId, gate: u8) -> Vec<Vec3> {
    let gx = GATE_X[(gate as usize).min(GATE_X.len() - 1)];
    match runway {
        RunwayId::Rwy27 => vec![
            Vec3::new(-28.0, 0.0, TAXIWAY_Z),
            Vec3::new(gx, 0.0, TAXIWAY_Z),
            Vec3::new(gx, 0.0, GATE_Z),
        ],
        RunwayId::Rwy27R => vec![
            Vec3::new(-38.0, 0.0, RWY27R_Z),
            Vec3::new(-38.0, 0.0, TAXIWAY_Z),
            Vec3::new(gx, 0.0, TAXIWAY_Z),
            Vec3::new(gx, 0.0, GATE_Z),
        ],
        RunwayId::Rwy18 => vec![
            Vec3::new(RWY18_X, 0.0, TAXIWAY_Z),
            Vec3::new(gx, 0.0, TAXIWAY_Z),
            Vec3::new(gx, 0.0, GATE_Z),
        ],
    }
}

/// Hold-short waiting position before entering the departure runway.
pub fn hold_short_pos(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(31.5, 0.0, 6.8),
        RunwayId::Rwy27R => Vec3::new(37.5, 0.0, -10.0),
        RunwayId::Rwy18 => Vec3::new(RWY18_X + 6.8, 0.0, 11.5),
    }
}

/// Line-up threshold position at the start of the takeoff roll.
pub fn lineup_pos(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(31.5, 0.0, RWY27_Z),
        RunwayId::Rwy27R => Vec3::new(31.5, 0.0, RWY27R_Z),
        RunwayId::Rwy18 => Vec3::new(RWY18_X, 0.0, 11.5),
    }
}

/// Rotation point where the aircraft lifts off during takeoff.
pub fn liftoff_pos(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(-10.0, 0.0, RWY27_Z),
        RunwayId::Rwy27R => Vec3::new(-10.0, 0.0, RWY27R_Z),
        RunwayId::Rwy18 => Vec3::new(RWY18_X, 0.0, -18.0),
    }
}

/// Far climbout destination where departing aircraft leave the airspace.
pub fn climbout_pos(runway: RunwayId) -> Vec3 {
    match runway {
        RunwayId::Rwy27 => Vec3::new(-82.0, 18.0, RWY27_Z - 4.0),
        RunwayId::Rwy27R => Vec3::new(-82.0, 18.0, RWY27R_Z - 6.0),
        RunwayId::Rwy18 => Vec3::new(RWY18_X - 4.0, 18.0, -82.0),
    }
}

/// Taxi-out waypoints from a gate's pushback point to the departure hold-short bar.
pub fn taxi_out_route(gate: u8, runway: RunwayId) -> Vec<Vec3> {
    let gx = GATE_X[(gate as usize).min(GATE_X.len() - 1)];
    match runway {
        RunwayId::Rwy27 => vec![
            Vec3::new(gx, 0.0, TAXIWAY_Z),
            Vec3::new(31.5, 0.0, TAXIWAY_Z),
            hold_short_pos(RunwayId::Rwy27),
        ],
        RunwayId::Rwy27R => vec![
            Vec3::new(gx, 0.0, TAXIWAY_Z),
            Vec3::new(37.5, 0.0, TAXIWAY_Z),
            hold_short_pos(RunwayId::Rwy27R),
        ],
        RunwayId::Rwy18 => vec![
            Vec3::new(gx, 0.0, TAXIWAY_Z),
            Vec3::new(RWY18_X + 6.8, 0.0, TAXIWAY_Z),
            hold_short_pos(RunwayId::Rwy18),
        ],
    }
}

/// Go-around climb waypoints that safely rejoin the overhead holding stack.
pub fn go_around_route(runway: RunwayId, hold_slot: u8) -> Vec<Vec3> {
    let alt = 13.0 + (hold_slot.min(4) as f32) * 3.0;
    match runway {
        RunwayId::Rwy27 | RunwayId::Rwy27R => vec![
            Vec3::new(-18.0, 9.0, -8.0),
            Vec3::new(-12.0, alt, -26.0),
            holding_stack_pos(std::f32::consts::PI, hold_slot),
        ],
        RunwayId::Rwy18 => vec![
            Vec3::new(RWY18_X + 12.0, 9.0, 20.0),
            Vec3::new(26.0, alt, 10.0),
            holding_stack_pos(0.4, hold_slot),
        ],
    }
}

/// Selects the preferred arrival runway for the active airfield layout.
pub fn pick_arrival_runway(layout: AirfieldLayout, counter: u32) -> RunwayId {
    match layout {
        AirfieldLayout::SingleRunway => RunwayId::Rwy27,
        AirfieldLayout::ParallelRunways => {
            if counter % 3 == 0 {
                RunwayId::Rwy27
            } else {
                RunwayId::Rwy27R
            }
        }
        AirfieldLayout::IntersectingRunways => {
            if counter % 2 == 0 {
                RunwayId::Rwy18
            } else {
                RunwayId::Rwy27
            }
        }
    }
}

/// Selects the preferred departure runway for the active airfield layout.
pub fn pick_departure_runway(layout: AirfieldLayout) -> RunwayId {
    match layout {
        AirfieldLayout::SingleRunway => RunwayId::Rwy27,
        AirfieldLayout::ParallelRunways => RunwayId::Rwy27,
        AirfieldLayout::IntersectingRunways => RunwayId::Rwy27,
    }
}
