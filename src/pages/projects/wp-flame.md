---
layout: ../../layouts/ProjectLayout.astro
title: WP Flame
description: A self-hosted performance flight recorder for dynamic WordPress, turning bounded request traces into explainable evidence—and a focused commercial software business.
tags:
  - Developer tools
  - Performance engineering
  - Commercial software
featured: true
period: 2026–present
status: Pre-release / design partners
role: Founder / product / engineering
externalUrl: https://wp-flame-web.vercel.app/
externalLabel: Explore WP Flame
imageUrl: /assets/projects/wp-flame/screenshot.webp
canonicalUrl: /projects/wp-flame
---

## Building around a real frustration

WordPress performance problems often arrive as a vague report: checkout occasionally stalls, the editor feels slow, or an update seems to have made the site worse. Browser-facing speed tests can confirm the symptom, but dynamic requests still execute plugins, themes, queries, hooks, and external API calls on the server. Finding the useful next step can mean hours of reproducing the problem, disabling components, reading logs, or asking a host to investigate.

WP Flame is my attempt to make that work more direct. It is a self-hosted WordPress performance monitoring and diagnosis plugin that records a bounded request, shows where the supported observed time went, and helps an operator decide what to investigate next.

The product is still in development. I am building it in public through a paid design-partner programme, using real slow workflows to test whether the evidence is understandable, whether it changes the next action, and whether the result saves enough expert time to become a product people will pay for.

## A flight recorder for WordPress

The product is deliberately positioned as a performance flight recorder rather than an automatic speed-optimisation plugin. WP Flame does not promise to cache a page, rewrite code, or make a score turn green. It is being built to make dynamic WordPress execution visible.

An administrator can capture a real request and inspect it as an interactive timeline. Supported lifecycle phases, compatible database work, WordPress HTTP API calls, and focused hook callbacks become spans whose width represents observed time. Attribution connects that work back to the best supported WordPress owner—core, a plugin, a theme, or another known source—so a technical graph can become a defensible handoff.

The intended workflow is simple:

1. **Capture** a bounded instance of the slow route or workflow.
2. **Understand** what was observed, what was unavailable, and which measured contributor deserves attention.
3. **Act and verify** by repeating compatible captures after a focused change.

That last step matters. A convincing diagnosis should lead to evidence that the same workflow improved, stayed the same, or remains inconclusive.

## Instrumentation with honest boundaries

Performance tooling has an unusual responsibility: it must observe a system without pretending that its own measurement is invisible. WordPress adds another layer of complexity because hosts, caching, database drop-ins, plugin stacks, and request types can all change what is available to capture.

WP Flame therefore uses multiple instrumentation modes. A conservative mode focuses on lower-risk supported lifecycle and HTTP activity; standard capture adds compatible database spans; a time-boxed deep mode can inspect supported WordPress callbacks when more detail is needed. Sampling, bounded span counts, retention controls, redaction, and compatibility-aware fallbacks are part of the product rather than deployment notes.

Just as importantly, a trace is meant to state its limitations. Missing telemetry is unknown, not zero. An unavailable counter should never quietly produce an excellent score, and the largest measured contributor should not be presented as a definitive root cause without supporting evidence.

That honesty makes the interface more demanding to design, but it is also the product's point of difference. WP Flame should help a professional make a better decision, not give a false sense of certainty.

## Building the whole product

My work spans the plugin's instrumentation architecture, trace and span model, local storage, privacy defaults, performance findings, interactive admin interface, command-line tools, release process, and compatibility strategy. The production plugin avoids a heavy runtime stack: PHP does the WordPress-native work, while the administration experience uses focused JavaScript and CSS.

I am also building the commercial surface around it. The marketing site demonstrates an illustrative trace before asking someone to install anything, explains the product's measurement boundary, and speaks to specific high-intent problems such as slow WooCommerce checkout, wp-admin delays, external APIs, cron work, and regressions after an update.

That separation between education and promise is deliberate. The website must not turn a roadmap item, synthetic example, or unverified compatibility target into a claim about the current product. Trust is easier to preserve when the limitations appear near the decision rather than deep in documentation.

## A deliberately small software business

WP Flame is also a commercial experiment: can I build a genuinely useful product once, support it well, reach customers through focused content and paid acquisition, and create recurring income without turning every sale into a new consulting project?

The working model gives a Community edition enough value to diagnose a real incident. A future Pro product can earn its place through recurring workflows: longer history, controlled monitoring, before-and-after comparisons, professional reporting, and support. The free product should establish trust; the paid product should create continuing confidence rather than withhold the basic answer.

I am testing that model before investing heavily in licensing or a larger service. Founder-led design partners provide the first evidence about time to value, willingness to pay, support effort, and which capabilities create repeat use. Paid advertising comes later, once the product proof and conversion path deserve traffic.

The ambition is leverage, not neglect. Performance software will always require compatibility work, documentation, and thoughtful support. The opportunity is to make that work compound across customers instead of starting from zero each time.

## What I am learning

WP Flame sits at the intersection of performance engineering, product truth, and commercial discipline. It is teaching me that a trustworthy developer tool is defined as much by what it refuses to claim as by what it can measure.

It is also a practical test of a different kind of company-building: smaller in scope, close to a painful job, capable of earning revenue early, and designed to remain useful without needing to become a venture-scale platform. If WP Flame succeeds, it will be because it helps someone replace a frustrating guess with evidence—and because the business around that moment is focused enough to last.
