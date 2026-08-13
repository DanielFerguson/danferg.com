---
layout: ../../layouts/ProjectLayout.astro
title: Chef
description: A completed meal-planning application prototype whose strongest ideas now live in portable, local-first Agent Skills.
tags:
  - Product design
  - Agent Skills
  - Local-first AI
  - Household planning
featured: true
period: "2026"
status: Application prototype archived / Agent Skills 0.1.0
role: Creator / product / full-stack & AI engineering
externalUrl: https://danferg.com/chef
externalLabel: Explore Chef Skills
caseStudyLabel: CASE STUDY // FROM APPLICATION TO PORTABLE SKILLS
visualLabel: PRODUCT THESIS / CONVERSATION_TO_PLAN
imageKey: chef
imageAlt: Chef meal-planning concept showing a natural-language request becoming a structured week of dinners
hideScreenshot: true
canonicalUrl: /projects/chef
publishedDate: "2026-07-17"
updatedDate: "2026-08-13"
---

## The fortnightly ritual I wanted to make easier

Every couple of weeks, my wife and I sit down to work out what we are going to eat. We talk through the nights ahead, find meals that sound good, make the grocery list, remember what has run out, and eventually place an order.

It works. It can also consume a few hours.

Chef began as my attempt to keep the freedom of shopping for ourselves while removing more of the coordination: who is eating, what we enjoyed last time, which nights are busy, what is already in the pantry, and whether the final shop still resembles the plan.

## The application prototype

The first Chef became a substantial private Laravel, Inertia and React application. It covered the journey from a planning conversation through editable plans, explicit household constraints, versioned recipes, traceable grocery lists, cooking progress and person-specific feedback.

Its central product rule was:

> Conversation is the primary interface for intent; structured state is the source of what the household actually decided.

That distinction mattered. A preference, allergy, meal, recipe version, list item or outcome could not exist only in model context. The model could interpret and propose, while normal application code owned persistence, authorization, approval and safety.

The prototype proved that this was a coherent product rather than a chat box attached to recipes. It also showed me how much application I would need to distribute and maintain before another household could try the useful part.

## Why the direction changed

The most interesting capability was never the Laravel interface itself. It was the workflow: riff naturally on a real week, keep the important household context, approve one exact plan, preserve the recipe versions behind it, prepare a grocery list, and learn from dinner.

Agent Skills make that workflow portable. They can guide an existing ChatGPT or Codex user without asking them to create another hosted account or move their planning into a new web application. A small local data utility can keep durable state on the user's computer instead of leaving it trapped in a conversation.

The finished application prototype is now archived in its private repository. I have kept its history because the domain model, tests and product decisions remain useful evidence. The active public direction is [Chef Skills](/chef).

## Five skills, one local record

The stable release separates the work into five focused skills:

1. **Plan meals** — conduct the household riff and approve one exact set of dates, slots, participants and servings.
2. **Manage the household** — keep explicit allergies and dietary requirements distinct from ordinary preferences.
3. **Manage recipes** — save immutable recipe versions and scale them without rewriting history.
4. **Prepare the shop** — compile and approve a provider-neutral grocery plan, with export as the dependable fallback.
5. **Record the outcome** — remember portions, effort, leftovers and feedback as evidence for the next plan.

All five share a Python and SQLite utility. The user chooses the folder. It holds households, people, explicit constraints, preferences, plans, exact recipe versions, grocery versions and outcomes, along with exports or backups the user requests. It is permission-restricted where supported, but not application-level encrypted in the first release.

## A deliberately smaller shopping promise

My early computer-use experiment successfully assembled a real grocery basket for review. It also exposed the fragile boundary around changing retailer sites, logged-in sessions, terms of service and uncertain verification.

The public release therefore makes Computer Use optional and provider-neutral. Chef always offers a Markdown or JSON grocery export. If an appropriate browser capability exists, it can prepare a basket only after the grocery plan is approved and the user gives a separate basket approval.

The automation uses absolute intended quantities and records one of five honest outcomes: succeeded, blocked, retryable, uncertain or failed. It cannot call the basket ready when verification is incomplete. Checkout, payment, fulfilment, restricted products and order placement remain human-controlled. Chef is not endorsed by Coles, Woolworths or another retailer.

## What is available now

The public `0.1.0` release includes the five skills, the local utility, an installable OpenAI plugin, portable Agent Skills packaging, tests and release documentation.

The [plugin ZIP](https://github.com/DanielFerguson/chef-skills/releases/download/v0.1.0/chef-plugin-0.1.0.zip), [portable Agent Skills ZIP](https://github.com/DanielFerguson/chef-skills/releases/download/v0.1.0/chef-agent-skills-0.1.0.zip), checksums, source and [installation guide](/chef/install) are publicly available. The OpenAI directory listing remains a separate future step before a one-click install button appears.

That feels like the right next experiment: less product surface, more of the useful behavior, and clearer boundaries around the parts that can cause harm or spend someone else's money.
