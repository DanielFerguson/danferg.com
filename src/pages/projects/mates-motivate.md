---
layout: ../../layouts/ProjectLayout.astro
title: Mates Motivate
iconUrl: /assets/projects/mates-motivate.svg
description: A social accountability MVP that helped people set a goal, build a visible check-in streak, and invite trusted friends to encourage the work and celebrate the result.
tags:
  - Behaviour design
  - Social product
  - Full-stack software
featured: true
period: "2022"
status: Archived MVP
role: Founder / product / engineering
externalUrl: https://github.com/DanielFerguson/matesmotivate.com
externalLabel: View source
imageUrl: /assets/projects/mates-motivate/screenshot.webp
canonicalUrl: /projects/mates-motivate
---

## Motivation is easier to borrow

Most goal products focus on the individual: choose a target, track a streak, and rely on a notification to keep going. My own experience was different. Fitness goals, creative projects, and the challenge of building twelve startups in twelve months all became easier when I had told someone I trusted what I intended to do.

Mates Motivate explored that relationship directly. It was built around a simple hypothesis: **accountability works better when it comes from a person who cares about you than from an app that wants your attention.**

## The core loop

The MVP reduced the product to a small number of actions:

1. Write down the behaviour or outcome you want to achieve.
2. Choose how often you will check in and how long the commitment will run.
3. Invite one or more mates to share responsibility for the goal.
4. Mark the days you complete the work and build a visible track record.
5. Let your mates encourage you when momentum slips and celebrate when you finish.

Goals supported daily, weekly, fortnightly, and monthly cadences. The interface turned each commitment into a simple run of check-in markers, making progress legible without building a complicated productivity system around it.

## Designing the relationship

The most interesting design work was deciding what a mate should be able to do. Too little involvement and the social layer becomes decorative; too much and encouragement starts to feel like surveillance.

Mates could see the goals they had been invited into, view the check-in record, and send encouragement. The owner stayed in control of the goal and could add or remove people. A completed check-in triggered a small moment of celebration rather than another leaderboard or public performance.

That kept the product centred on support:

- **Encourage** someone when the work is difficult.
- **Motivate** them through a commitment they chose themselves.
- **Celebrate** the outcome together.

## What I built

I moved from user stories to a deliberately plain prototype before investing in polish. Mocking up the data model and experience together helped expose the relationships the backend would need: users own goals, mates share responsibility, check-ins form the history, and encouragement belongs to a particular person, goal, and day.

The working MVP used Laravel for the application and domain model, React and Inertia for the interface, Tailwind for styling, and Laravel Socialite for the original Twitter-based identity and invitation flow. It included goal creation and editing, configurable streaks, friend invitations, check-ins, encouragement, progress history, and completion feedback.

## What I learned

Mates Motivate was a useful exercise in building the smallest version of an idea that could test its real assumption. The question was never whether people liked streaks or confetti. It was whether bringing an existing relationship into the product changed the likelihood of following through.

The project also showed the risk of tying a social product too closely to another platform's identity system. Twitter handles made the first invitation flow fast to build, but they also made the product dependent on a network it did not control. The durable idea was the accountability relationship—not the provider used to find a mate.
