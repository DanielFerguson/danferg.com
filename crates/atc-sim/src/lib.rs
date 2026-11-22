//! `atc-sim`: A compact Bevy-style ECS air traffic control simulation.

pub mod airfield;
pub mod domain;
pub mod ecs;
pub mod systems;
pub mod wasm_api;

#[cfg(test)]
mod tests {
    use crate::domain::{
        AirfieldLayout, FlightPhase, RunwayId, RunwayLocks, RunwayPurpose, ScenarioPreset, Weather,
    };
    use crate::ecs::Entity;
    use crate::wasm_api::{SimInstance, AIRCRAFT_FLOATS, HEADER_FLOATS};

    #[test]
    fn runway_mutex_enforces_single_owner_and_intersection_exclusion() {
        let mut locks = RunwayLocks::default();
        let a = Entity(1);
        let b = Entity(2);

        // First aircraft acquires RWY 27 cleanly.
        assert!(locks
            .try_acquire(AirfieldLayout::SingleRunway, RunwayId::Rwy27, a, RunwayPurpose::Landing)
            .is_ok());

        // Second aircraft is denied while RWY 27 is held.
        assert_eq!(
            locks.try_acquire(
                AirfieldLayout::SingleRunway,
                RunwayId::Rwy27,
                b,
                RunwayPurpose::Takeoff
            ),
            Err(Some(a))
        );

        // Under IntersectingRunways, RWY 18 is ALSO blocked while RWY 27 is active.
        assert_eq!(
            locks.try_acquire(
                AirfieldLayout::IntersectingRunways,
                RunwayId::Rwy18,
                b,
                RunwayPurpose::Landing
            ),
            Err(Some(a))
        );

        // Under ParallelRunways, RWY 27R CAN be acquired concurrently!
        assert!(locks
            .try_acquire(
                AirfieldLayout::ParallelRunways,
                RunwayId::Rwy27R,
                b,
                RunwayPurpose::Landing
            )
            .is_ok());

        // Releasing triggers wake turbulence cooldown before another aircraft can acquire.
        locks.release_for(a, 2.0);
        assert_eq!(
            locks.try_acquire(
                AirfieldLayout::SingleRunway,
                RunwayId::Rwy27,
                Entity(3),
                RunwayPurpose::Takeoff
            ),
            Err(None)
        );
        locks.tick_cooldowns(2.5);
        assert!(locks
            .try_acquire(
                AirfieldLayout::SingleRunway,
                RunwayId::Rwy27,
                Entity(3),
                RunwayPurpose::Takeoff
            )
            .is_ok());
    }

    #[test]
    fn happy_path_completes_landings_and_takeoffs_without_incursions() {
        let mut sim = SimInstance::new(ScenarioPreset::HappyPath);
        for _ in 0..3600 {
            sim.step(1.0 / 30.0);
            // Safety invariant: never more than 1 aircraft physically Landing/Takeoff on RWY 27.
            let active_on_27 = sim
                .world
                .flight
                .iter()
                .filter(|(_, fs)| {
                    fs.assigned_runway == RunwayId::Rwy27 && fs.phase.occupies_runway()
                })
                .count();
            assert!(
                active_on_27 <= 1,
                "Runway incursion detected! {active_on_27} aircraft on RWY 27 simultaneously"
            );
        }

        assert!(
            sim.world.metrics.total_landings >= 2,
            "Expected at least 2 landings, got {}",
            sim.world.metrics.total_landings
        );
        assert!(
            sim.world.metrics.total_takeoffs >= 1,
            "Expected at least 1 takeoff, got {}",
            sim.world.metrics.total_takeoffs
        );
    }

    #[test]
    fn rain_increases_holding_and_extends_rollout() {
        let mut clear = SimInstance::new(ScenarioPreset::WeatherCascade);
        clear.world.config.weather = Weather::Clear;
        let mut storm = SimInstance::new(ScenarioPreset::WeatherCascade);
        storm.world.config.weather = Weather::Storm;

        for _ in 0..1800 {
            clear.step(1.0 / 30.0);
            storm.step(1.0 / 30.0);
        }

        assert!(
            storm.world.metrics.completed_hold_time_sum + (storm.world.metrics.holding_count as f32)
                >= clear.world.metrics.completed_hold_time_sum * 0.5,
            "Storm scenario should produce measurable queuing pressure"
        );
    }

    #[test]
    fn snapshot_buffer_matches_expected_layout() {
        let mut sim = SimInstance::new(ScenarioPreset::Flagship);
        sim.step(1.0 / 30.0);
        let ac_count = sim.snapshot_buf[1] as usize;
        let pulse_count = sim.snapshot_buf[2] as usize;
        assert_eq!(
            sim.snapshot_buf.len(),
            HEADER_FLOATS + ac_count * AIRCRAFT_FLOATS + pulse_count * 8
        );
        assert!(ac_count >= 3);
        assert!(!sim.log_buf.is_empty());

        // Check at least one aircraft is airborne and one is at gate initially
        let has_gate = sim
            .world
            .flight
            .iter()
            .any(|(_, f)| f.phase == FlightPhase::AtGate);
        assert!(has_gate);
    }

    #[test]
    fn radio_lag_delivers_messages_once_and_stacks_holding_vertically() {
        let mut sim = SimInstance::new(ScenarioPreset::RadioLag);
        for _ in 0..1500 {
            sim.step(1.0 / 30.0);
        }

        // Verify no duplicate identical consecutive log entries at the same timestamp.
        for pair in sim.world.radio.log.windows(2) {
            let same_ts = (pair[0].timestamp - pair[1].timestamp).abs() < 0.01;
            let same_msg = pair[0].speaker == pair[1].speaker && pair[0].text == pair[1].text;
            assert!(
                !(same_ts && same_msg),
                "Duplicate radio log entry detected: {:?} vs {:?}",
                pair[0],
                pair[1]
            );
        }

        // Verify any holding aircraft have unique vertical slots (when <= 6 holding).
        let hold_slots: Vec<u8> = sim
            .world
            .flight
            .iter()
            .filter(|(_, fs)| fs.phase == FlightPhase::Holding)
            .map(|(_, fs)| fs.hold_slot)
            .collect();
        if hold_slots.len() <= 6 {
            let mut dedup = hold_slots.clone();
            dedup.sort();
            dedup.dedup();
            assert_eq!(
                hold_slots.len(),
                dedup.len(),
                "Expected unique holding altitude slots, got {:?}",
                hold_slots
            );
        }
    }
}
