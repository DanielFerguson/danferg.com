---
layout: ../../layouts/ProjectLayout.astro
title: Chef
description: A meal-planning application prototype distilled into two conversational Agent Skills with transparent Markdown memory.
tags:
  - Product design
  - Agent Skills
  - Local-first AI
  - Household planning
featured: true
period: "2026"
status: Application prototype archived / Agent Skills 0.2.0
role: Creator / product / full-stack & AI engineering
externalUrl: https://danferg.com/chef
externalLabel: Explore Chef Skills
caseStudyLabel: CASE STUDY // FROM APPLICATION TO CONVERSATIONAL SKILLS
visualLabel: PRODUCT THESIS / CONVERSATION_TO_MEMORY
imageKey: chef
imageAlt: Chef meal-planning concept showing a natural-language request becoming a structured week of dinners
hideScreenshot: true
canonicalUrl: /projects/chef
publishedDate: "2026-07-17"
updatedDate: "2026-08-24"
---

## The fortnightly ritual I wanted to make easier

Every couple of weeks, my wife and I sit down to work out what we are going to eat. We talk through the nights ahead, find meals that sound good, make the grocery list, remember what has run out, and eventually place an order.

It works. It can also consume a few hours.

Chef began as my attempt to keep the freedom of shopping for ourselves while removing more of the coordination: who is eating, what we enjoyed last time, which nights are busy, what is already in the pantry, and whether the final shop still resembles the plan.

## The application prototype

The first Chef became a substantial private Laravel, Inertia and React application. It covered the journey from a planning conversation through editable plans, explicit household constraints, versioned recipes, traceable grocery lists, cooking progress and person-specific feedback.

Its central product rule was:

> Conversation is the primary interface for intent; structured state is the source of what the household actually decided.

That distinction still matters. An allergy, preference, meal, grocery item or outcome should not quietly disappear when a chat ends. The prototype showed that the workflow was coherent, but it also showed how much application I would need to distribute and maintain before another household could try the useful part.

## The first simplification was not simple enough

I initially turned the product into five portable Agent Skills backed by a Python utility and SQLite. That became Chef 0.1. It retained the strongest parts of the application model: explicit safety records, immutable recipe versions, plan and grocery states, traceable approvals and verified basket quantities.

It was technically tidy. It was also asking someone planning dinner to operate a small records system.

The mismatch became particularly obvious in the conversations I actually wanted Chef to support. A useful exchange might begin with a few dinner ideas, continue with “let’s do the chicken schnitzel”, then move straight into the recipe and a single-serve calorie estimate for Bevel. Another week might involve “we had the burgers”, “what’s left?” and “we already have rice and soy sauce”. None of those moments benefits from an internal ID or an approval phrase.

The database was solving problems the public skill did not yet have.

## Markdown is enough for this version

Chef 0.2 reduces the public product to two skills. The main `chef` skill handles household setup, planning, recipes, cooking guidance, nutrition estimates and feedback. `chef-prepare-shop` handles grocery lists and explicitly requested basket filling.

On local Codex, the durable record is now ordinary Markdown under `~/Documents/Chef`:

- `MEMORY.md` keeps the household, explicit safety requirements, preferences, planning defaults, usual staples and a compact current-plan checklist.
- `plans/YYYY-Www.md` keeps the detailed week, temporary pantry declarations, grocery list, recipes used during planning and reported outcomes.
- `recipes/<slug>.md` exists only when someone explicitly asks to save, favourite or repeat a recipe.

This is deliberately less clever. People can read the files, fix my wording, add their own section and back them up with whatever they already use. The skill re-reads a file immediately before changing it and patches only the relevant section, so an unknown heading is not an invitation to rewrite the document.

Built-in agent memory can still be a useful recall cue, but it is not Chef’s source of household truth. On a host without local file access, Chef continues the conversation for that session and says honestly that nothing was saved.

## What Chef remembers without making dinner feel like data entry

Clear statements can be useful immediately. If someone says they love Korean food, dislike mushrooms or usually plan four dinners, Chef records it without asking them to confirm what they just said. A direct allergy or safety statement is recorded and acknowledged.

Ambiguity is different. “We avoid peanuts” might describe an allergy, a household rule or an ordinary preference. Chef asks before putting that in the safety section. Feedback can become an observation, but it cannot silently become an allergy. Weakening a safety requirement still needs an explicit instruction.

The same principle applies to plans. “We had burgers” can tick off the matching meal. “Let’s do the schnitzel tonight” can move it to tonight. The underlying file remains structured enough to answer “what’s left?”, but the household does not have to speak in state transitions.

## A smaller, clearer shopping boundary

The early computer-use experiment successfully assembled a real grocery basket for review. It also exposed the fragile boundary around changing retailer sites, logged-in sessions, product substitutions and uncertain verification.

Chef 0.2 keeps one consequential distinction. Asking for a grocery list does not change a basket. Directly asking Chef to “fill my cart” does.

That request is sufficient authority; there is no token to repeat. Chef still inspects and preserves the existing basket, works with absolute intended quantities, checks explicit dietary requirements where current product information is visible and verifies the final basket itself. If one line cannot be verified, it says which one rather than calling the shop complete.

Checkout, payment, fulfilment, address changes, restricted products and order placement remain human-controlled. Chef is not endorsed by Coles, Woolworths or another retailer.

## What is available now

The public `0.2.0` release includes the two instruction-only skills, three Markdown templates, an installable OpenAI plugin, portable Agent Skills packaging, synthetic acceptance cases and deterministic release checks.

The [plugin ZIP](https://github.com/DanielFerguson/chef-skills/releases/download/v0.2.0/chef-plugin-0.2.0.zip), [portable Agent Skills ZIP](https://github.com/DanielFerguson/chef-skills/releases/download/v0.2.0/chef-agent-skills-0.2.0.zip), checksums, source and [installation guide](/chef/install) are publicly available. The [0.1.0 release](https://github.com/DanielFerguson/chef-skills/releases/tag/v0.1.0) remains archived for anyone who wants the records-oriented version. OpenAI directory submission is still a separate step.

I think this is closer to the product I was trying to build in the first place: enough memory to make the next conversation better, in a form a person can inspect, without making the household learn the machinery behind it.
