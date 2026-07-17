---
layout: ../../layouts/ProjectLayout.astro
title: Chef
description: A voice-first meal planner that turns one household conversation into a durable plan, shopping list, and cooking guidance, with retailer handoff next.
tags:
  - Product design
  - Laravel / React
  - AI agents
  - Household planning
featured: true
period: "2026"
status: Private testing / active development
role: Creator / product / full-stack & AI engineering
externalUrl: https://chef.danferg.com
externalLabel: Visit Chef
caseStudyLabel: CASE STUDY // FROM CONVERSATION TO DINNER
visualLabel: PRODUCT THESIS / CONVERSATION_TO_PLAN
imageKey: chef
imageAlt: Chef meal-planning concept showing a natural-language request becoming a structured week of dinners
canonicalUrl: /projects/chef
publishedDate: "2026-07-17"
updatedDate: "2026-07-17"
---

## The fortnightly ritual I wanted to make easier

Every couple of weeks, my wife and I sit down to work out what we are going to eat. We talk through the nights ahead, find meals that sound good, make the grocery list, remember the things we have run out of, and eventually place an order.

It is a sensible ritual, and it works. It can also consume a few hours.

I have always wanted something between the convenience of HelloFresh and the freedom of shopping for ourselves. Meal kits remove decisions, but they also decide the range, portions, packaging, and retailer. Doing everything ourselves gives us control, but leaves us to repeatedly connect the same scattered decisions: who is eating, what we enjoyed last time, which nights are busy, what is already in the pantry, and whether the final shop still resembles the plan.

Chef is my attempt to keep the freedom while removing more of that coordination.

## The prototype was a conversation

Before building a product, I had already started using ChatGPT and Codex as a meal-planning assistant. Natural language was a much better starting point than a grid of empty recipe slots. I could describe the shape of the fortnight, negotiate suggestions, ask for a shopping list, and keep adjusting until the plan felt like ours.

I then tested the harder handoff with a computer-use agent. It successfully found the products and assembled the Coles basket; after I reviewed the shop and checked out, it arrived as a normal delivery. That experiment made the opportunity feel real. A model could do more than suggest recipes: it could carry intent into useful action.

The problem was everything around that successful run.

The plan lived inside one thread among many. Finding it again was awkward. A new fortnight raised the question of whether to continue the old conversation or start another. Important household context was mixed into chat history, while the actual plan, recipes, shopping state, and cooking instructions had no dedicated home.

A capable assistant was not enough. The workflow needed a product.

## Six years after Hamburger

Chef is not my first attempt at the question “what are we having for dinner?”

In 2020, while living in a share house, I built [Hamburger](https://github.com/DanielFerguson/hamburger), a small Dart and Flutter experiment for finding recipes, receiving random meal recommendations, saving favourites, and stepping through the cooking process. It was designed to help a group of people organise meals, share preparation, and make the cost of feeding the house easier to manage.

Hamburger treated the recipe collection as the centre of the experience. Six years later, Chef starts somewhere different: with the household conversation that happens before anyone knows which recipes they need.

The old project still matters to me because it shows that the problem has persisted while the technology has changed underneath it. Flutter offered one route to a cross-platform application. Today I am much more convinced by the web: low-friction onboarding, no app-store gate, a link that works almost everywhere, and one product surface that can move naturally between laptop planning, phone shopping, and a kitchen screen.

## Conversation in, structure out

Chef is not a recipe catalogue with an AI chat box attached. Its central design rule is:

> Conversation is the primary interface for intent; structured UI is the source of visible, editable state.

The household should be able to say, “Plan five dinners for four. Tuesday is only two of us, Thursday needs to be quick, and use the spinach first.” Chef can ask a useful follow-up, propose a coherent set of meals, and explain its choices.

Beside that conversation, the product builds durable state the household can inspect and change directly:

1. **Plan** — discuss the real week, its participants, constraints, appetite, time, and budget.
2. **Review** — make the dates, servings, recipes, leftovers, preparation, and open nights concrete.
3. **Shop** — combine recipe ingredients, account for pantry items, add household staples, and retain where every requirement came from.
4. **Cook and learn** — open tonight’s meal, work through the exact recipe version, and keep feedback that can improve a later plan.

Natural language remains available throughout, but it is never the only record of what the household decided. A preference, allergy, meal, recipe version, list item, or outcome must exist as application data rather than disappearing into model context.

## What exists today

The current private build covers the path from a first planning conversation through to cooking and feedback.

Chef supports shared households, individual meal participants, explicit safety constraints, attributed preferences, arbitrary plan date ranges, versioned recipes, direct meal-plan editing, and a continuous planning conversation. Confirmed meals become a traceable shopping list whose quantities scale to the people eating. Pantry decisions, manual staples, budget changes, and list revisions remain visible rather than being flattened into generated prose.

The “what are we cooking tonight?” side now has its own focused experience. A cook can see the relevant meal, follow durable step-by-step progress and timers, record what actually happened, and leave person-specific feedback. Chef may turn that feedback into a preference candidate, but never silently promote a dislike into an allergy or other safety rule.

The next milestone is the retailer handoff: matching intended ingredients to products and preparing a Woolworths or Coles trolley through computer use. Chef will own the intended list and the audit trail; the agent will operate as a retailer adapter. The household will still review the trolley and remain responsible for checkout, payment, and delivery details.

## An experiment in product-shaped AI

Chef is also a deliberate technical experiment.

For years at Communiti Labs, I worked within important expectations around sovereignty, privacy, and explainability for public-interest data. Chef gives me a different boundary: a personal household problem where I can explore current hosted AI capabilities more freely while still designing explicit safety and human-control rules.

The application is a Laravel monolith with Inertia, React, and TypeScript. The Laravel AI SDK provides typed agents, structured output, tools, streaming, queues, events, and test fakes for the ordinary planning experience. Those agent tools call the same authorised domain actions as the structured interface, so an AI request cannot invent a second set of business rules.

The more agentic capabilities need different boundaries. Chef is designed to use OpenAI Realtime for voice and a Chef-owned Responses API loop for computer use, with a permissioned browser extension executing validated local actions. Screenshots and retailer pages are treated as untrusted input, and approval is required at the point where an external action becomes consequential.

That architecture is part of the product thesis. The model can interpret, propose, explain, and act, but it should not become the household database, the permission system, or an invisible authority.

## The standard I am aiming for

The goal is not to maximise the amount of AI in dinner. It is to make one recurring household job feel remarkably lighter.

I want my wife and me to be able to sit down, speak naturally about the fortnight ahead, and finish with a plan we both understand, a list we can inspect, and a trolley ready for review—in one focused session rather than a few hours spread across tabs and conversations.

If Chef works, it will preserve the best part of our existing ritual: deciding together. The software will carry more of everything that happens after.
