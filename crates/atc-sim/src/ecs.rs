//! A compact, zero-dependency, Bevy-style Entity Component System.
//!
//! Designed for readability and tiny WebAssembly output:
//! - `Entity` is a lightweight integer handle.
//! - `ComponentStore<T>` stores sparse components keyed by entity ID.
//! - `Events<T>` provides double-buffered event queues cleared each tick.
//! - `Schedule` runs deterministic systems in explicit stage order.

use std::collections::BTreeMap;

/// Lightweight identifier for an entity in the simulation world.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Entity(pub u32);

/// Sparse component storage keyed by `Entity`.
///
/// Using `BTreeMap` guarantees deterministic iteration order across runs,
/// which makes our simulation reproducible and easy to test.
#[derive(Debug, Clone)]
pub struct ComponentStore<T> {
    items: BTreeMap<Entity, T>,
}

impl<T> Default for ComponentStore<T> {
    fn default() -> Self {
        Self {
            items: BTreeMap::new(),
        }
    }
}

impl<T> ComponentStore<T> {
    pub fn insert(&mut self, entity: Entity, value: T) -> Option<T> {
        self.items.insert(entity, value)
    }

    pub fn remove(&mut self, entity: Entity) -> Option<T> {
        self.items.remove(&entity)
    }

    pub fn get(&self, entity: Entity) -> Option<&T> {
        self.items.get(&entity)
    }

    pub fn get_mut(&mut self, entity: Entity) -> Option<&mut T> {
        self.items.get_mut(&entity)
    }

    pub fn iter(&self) -> impl Iterator<Item = (Entity, &T)> {
        self.items.iter().map(|(&e, v)| (e, v))
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = (Entity, &mut T)> {
        self.items.iter_mut().map(|(&e, v)| (e, v))
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn clear(&mut self) {
        self.items.clear();
    }
}

/// Bevy-style double-buffered event queue.
///
/// Systems read events emitted during the previous frame or earlier in the
/// current tick, while newly sent events stay readable until the next swap.
#[derive(Debug, Clone)]
pub struct Events<T> {
    previous: Vec<T>,
    current: Vec<T>,
}

impl<T> Default for Events<T> {
    fn default() -> Self {
        Self {
            previous: Vec::new(),
            current: Vec::new(),
        }
    }
}

impl<T> Events<T> {
    pub fn send(&mut self, event: T) {
        self.current.push(event);
    }

    pub fn read(&self) -> impl Iterator<Item = &T> {
        self.previous.iter().chain(self.current.iter())
    }

    pub fn drain_current(&mut self) -> impl Iterator<Item = T> + '_ {
        self.current.drain(..)
    }

    pub fn update(&mut self) {
        self.previous.clear();
        std::mem::swap(&mut self.previous, &mut self.current);
    }

    pub fn clear(&mut self) {
        self.previous.clear();
        self.current.clear();
    }
}

/// Deterministic xorshift64 pseudo-random generator (no external `rand` crate).
#[derive(Debug, Clone)]
pub struct SimRng {
    state: u64,
}

impl SimRng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { 0x9E37_79B9_7F4A_7C15 } else { seed },
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    pub fn next_f32(&mut self) -> f32 {
        ((self.next_u64() >> 40) as f32) / ((1u32 << 24) as f32)
    }

    pub fn range_f32(&mut self, min: f32, max: f32) -> f32 {
        min + self.next_f32() * (max - min)
    }

    pub fn range_usize(&mut self, len: usize) -> usize {
        if len == 0 {
            0
        } else {
            (self.next_u64() as usize) % len
        }
    }
}

/// Ordered list of systems executed on every fixed simulation tick.
pub struct Schedule<W> {
    systems: Vec<fn(&mut W)>,
}

impl<W> Default for Schedule<W> {
    fn default() -> Self {
        Self {
            systems: Vec::new(),
        }
    }
}

impl<W> Schedule<W> {
    pub fn add_systems(mut self, system: fn(&mut W)) -> Self {
        self.systems.push(system);
        self
    }

    pub fn run(&self, world: &mut W) {
        for system in &self.systems {
            system(world);
        }
    }
}
