---
layout: ../../layouts/ProjectLayout.astro
title: Airproxy
description: An edge-first cache and proxy that made Airtable practical as a production backend without inheriting rate limits, attachment constraints, or operational fragility.
tags:
  - Developer tools
  - Cloud infrastructure
  - SaaS
featured: false
period: "2023"
status: Archived product
role: Co-founder / product / engineering
imageKey: airproxy
canonicalUrl: /projects/airproxy
---

## The tension inside Airtable

Airtable is excellent at one side of the content problem. Non-technical teams can model information, update records, and work in an interface that feels more like a spreadsheet than a traditional CMS. The difficulty starts when that same data has to power a customer-facing product.

The API was limited to five requests per second, attachment behaviour was changing, and serving every request directly from Airtable created a fragile dependency at exactly the point a product needed reliability. Teams either introduced another CMS or built an internal caching layer—both of which undermined the simplicity that made Airtable attractive in the first place.

I encountered that problem while serving as CTO at Imperial Wealth. A small development team supported five largely independent business units, each with its own customers, content, and release schedule. Airtable helped subject-matter experts contribute directly, but the infrastructure between Airtable and the products became an operational burden.

## The prototype that proved the need

The first solution was a pragmatic Laravel proxy running on AWS. It cached Airtable responses and kept customer applications moving without requiring a wholesale change to the content workflow.

It worked—until demand made its limitations visible. Saturday traffic peaks could put roughly 90% of the user base online while internal experts were changing the underlying records. Cache invalidations, bursts of requests, and a single server combined into the kind of failure that demanded a manual restart at exactly the wrong time.

That experience turned an internal workaround into a clearer product question: **could the useful parts of Airtable remain, while the production risk disappeared?**

## What I built

Airproxy was the productised answer: a cloud-native layer between Airtable and the applications consuming its data.

- Requests could be cached close to the user instead of repeatedly travelling back to Airtable.
- Traffic spikes could be absorbed by edge infrastructure rather than a single long-running server.
- Files and other static assets could be delivered independently of Airtable's attachment constraints.
- API credentials and the underlying base structure stayed behind the proxy instead of leaking into client applications.
- Product teams retained the editing experience their non-technical colleagues already understood.

The architecture used Cloudflare Workers, KV, and Durable Objects for the edge and caching layer; Node and Upstash QStash for background work; and Next.js, Tailwind, and Vercel for the customer-facing product. I launched it in early 2023 with a co-founder, taking it from an operational lesson to a public developer product.

## The product judgement

The most important decision was not technical. Airproxy did not ask teams to migrate their data, retrain their colleagues, or adopt a larger platform. It made an existing workflow more dependable.

That constraint kept the value proposition sharp: use Airtable for what it is unusually good at, and use Airproxy for the production responsibilities Airtable was never designed to carry.

## What I learned

Airproxy taught me the difference between solving a problem once and turning that solution into a product. The code that rescues one team can tolerate assumptions, manual intervention, and institutional knowledge. A product has to replace those assumptions with safe defaults, understandable failure modes, and an onboarding path for people who were not in the room when it was designed.

It also reinforced a principle that has followed me into later work: the best infrastructure products do not create more work to justify their existence. They quietly remove a source of anxiety and let the team return to the thing its customers actually value.
