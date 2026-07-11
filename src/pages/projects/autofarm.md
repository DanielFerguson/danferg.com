---
layout: ../../layouts/ProjectLayout.astro
title: AutoFarm
iconUrl: /assets/projects/autofarm.png
description: An unreleased Rust and Bevy farming game where players learn the work by hand, then reclaim time by configuring drones and machines to do it well.
tags:
  - Game development
  - Rust / Bevy
  - Automation
featured: true
period: 2026–present
status: Unreleased / in development
role: Creator / game design / Rust engineering
imageUrl: /assets/projects/autofarm/screenshot.webp
canonicalUrl: /projects/autofarm
---

## A game I have wanted to make

AutoFarm brings together several parts of my life that do not usually meet in the same project: a love of farming games, a background in software, firsthand experience building a real agricultural business, and a fascination with drones and autonomous equipment.

It is an unreleased top-down farming game built in Rust with the Bevy engine. The player is a software engineer who has spent their savings taking over their parents' small Australian property. The farm needs to earn before ambitious technology can be funded, so the opening is deliberately grounded: inspect the workshop, prepare soil, plant wheat, water it, manage the crop, harvest, sell the produce, and slowly repair what has been left behind.

The fantasy is not escaping the farm work. It is understanding that work well enough to automate it.

## Manual first, automation second

AutoFarm is built around one progression promise:

1. **Learn** a task by doing it manually.
2. **Feel the pressure** as the same work expands beyond a comfortable scale.
3. **Automate** the task with a machine and a clear assignment.
4. **Care** for the equipment when understandable problems appear.
5. **Improve** the system through research, upgrades, and better decisions.
6. **Expand** into a larger field, crop, contract, or technical challenge.

That sequence prevents automation from becoming decoration. The player should know exactly what a machine has saved them from because they have already done the job themselves. When a drone waters a crop tile for the first time, the satisfaction comes from recognising the state change and knowing that the assignment caused it.

## Making the farm work matter

The current build contains the complete manual crop and story-to-laptop slice. The player moves through a small pixel-art property, follows a visible objective, learns the core tools progressively, and works toward the money needed to repair the workshop.

Wheat moves through eight visible stages from seed to withered crop. It needs water at three readable checkpoints, accumulates water stress when neglected, develops light or heavy weeds, and produces between one and five units depending on care and harvest timing. A well-tended crop therefore creates more than a prettier field: it creates the income that funds the next part of the farm.

The early rules are intentionally forgiving. Neglected wheat loses yield rather than disappearing completely, and a late crop remains harvestable. The systems are there to teach observation and make consistency valuable, not to turn the first paddock into punishment.

## Automation should earn freedom

Many automation games begin with the machine. AutoFarm begins with the reason the machine matters.

The player can manage the starter crop by hand, but larger plots make watering, weeds, timing, and visual inspection increasingly difficult. That growing inconvenience is part of the design. Automation becomes a response to a problem the player has felt rather than an abstract upgrade purchased from a menu.

The aim is for every successful machine to permanently remove enough repeated labour that the player gains real capacity. That time can be spent expanding the farm, improving equipment, researching a better system, helping a neighbour, or learning a new part of the simulation. Maintenance and failure should create decisions, but they should not quietly add the old chore back under a different name.

## A laptop, not an IDE

The original idea leaned heavily toward programming machines inside the game. As the project developed, the more interesting direction became clear: the core experience should be approachable visual automation, not a coding exercise.

The portable laptop detaches the camera into an aerial planning view while leaving the player in place. It is designed as a calm farm tool with an equipment list, job selection, map tools, assignment summary, battery and status information, and explicit run and pause controls.

The first useful assignment will be deliberately narrow. The player selects a homemade quadcopter, chooses `Water once`, paints a freeform work region, marks any avoidance areas, reviews validation, and runs the job. The drone should water every eligible crop tile, return to its pad, and report what happened in plain language.

Coding may return much later as an optional mastery layer. It is not required to understand or enjoy the farm.

## What exists today

The completed v0.5 build establishes the story, manual farming economy, workshop goal, portable laptop, and aerial planning shell. It also includes a tile-based world, animated water, collisions, interaction and dialogue, crop inspection, variable yield, selling, local save/load, and a packaged macOS build.

The current v0.6 milestone is the first useful drone. Its success criterion is simple and important: a player should be able to assign watering without writing code, then watch at least one dry crop tile visibly become watered because of that decision.

AutoFarm remains unreleased. The laptop currently communicates the shape of the automation system, while live drone work, battery care, the daily rhythm, and the friend-ready vertical slice are still being built.

## Building a game with Rust and Bevy

Part of AutoFarm is the game itself; part of it is my way of learning game development through a language and engineering style I enjoy.

The project uses Rust 2024 and Bevy's entity-component-system model. The code favours small, explicit systems for movement, farming, crop lifecycles, interaction, economy, progression, workshop state, the laptop, and saving. The simulation keeps ground, moisture, crops, weeds, yield, objects, and progression as logical state, then derives the visible world from it.

That separation matters for the automation roadmap. Manual tools, drones, and future ground bots should all act on the same farm rules. A crop should not behave differently because a machine watered it instead of the player.

The visual direction uses crisp, warm pixel art at a readable tile scale, with a small Australian property rather than a generic endless field. The intention is closer to a grown-up rural adventure than an industrial dashboard: welcoming on the surface, with deeper systems revealed as the farm becomes more capable.

## What building it is teaching me

Software products can often hide complexity behind a cleaner interface. Games have to do something harder: make the complexity understandable, then make interacting with it feel worthwhile.

AutoFarm has pushed me to think about motivation, pacing, feedback, consequence, and emotional payoff alongside architecture. A technically working drone is not enough. The player needs to understand why it matters, see the change it creates, and feel that they earned the moment.

It has also reinforced the value of building the smallest complete promise. The project does not need dozens of crops, machines, or research trees before it can feel like AutoFarm. It needs one manual task, one visible source of pressure, and one well-configured machine that genuinely gives time back.

## The broader ambition

The longer-term direction includes battery recovery, research and machine upgrades, heat and Australian weather, ground bots, neighbour contracts, and broad Farming, Engineering, and Automation masteries.

Those systems should deepen the same central loop rather than compete with it: understand the work, build a capable system, respond when reality interferes, and use the capacity you create to attempt something more ambitious.

The north star is a calm farming game about agency. The farm should become more automated over time, but it should always feel like a place the player understands and a system they shaped themselves.
