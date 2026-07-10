---
layout: ../../layouts/ProjectLayout.astro
title: Observer
iconUrl: /assets/projects/observer.svg
description: A service-monitoring prototype designed to warn small teams before their customers did, track recovery, and turn infrastructure anxiety into a clear operational signal.
tags:
  - Developer tools
  - Service monitoring
  - SaaS
featured: true
period: "2022"
status: Private-beta prototype
role: Founder / product / engineering
imageUrl: /assets/projects/observer/screenshot.webp
canonicalUrl: /projects/observer
---

## The call no technical leader wants

Before Observer, an outage at Imperial Wealth often became visible through a director receiving worried questions from customers. By the time the problem reached the development team, people had already missed opportunities and the response had inherited someone else's urgency.

One Saturday morning, the flow changed. Observer sent me a text message when a production service failed. I was able to open AWS, inspect the logs, restart the service, and ship a fix before customers realised what had happened. A second message confirmed that the service was healthy again.

That experience captured the product in one sentence: **the team responsible for a service should learn about a failure before the people depending on it.**

## More than a red status light

Basic uptime checks are easy to describe. The harder problem is turning a failed check into information that helps a small team act.

Observer was designed around the full incident loop:

- Continuously monitor websites, APIs, and critical services.
- Alert the right person when a check starts failing.
- Show how long the service has been unavailable.
- Confirm recovery instead of leaving an operator wondering whether the fix worked.
- Keep a simple history so recurring reliability problems become visible.
- Share monitors with a team rather than attaching operational knowledge to one person.

The dashboard presented recent performance and incident data without trying to become a full enterprise observability suite. The product was for founders and small teams who needed confidence, not another system that required its own operator.

## Building from a real operating environment

Observer began with services I was already responsible for. That made the early prioritisation unusually concrete: alerts had to arrive quickly, the mobile experience mattered, and a recovery notification was as important as the outage notification.

I then moved the product into a private beta with friends and colleagues, using their real websites and infrastructure to test where my assumptions broke. The roadmap expanded to include teams, a more useful mobile dashboard, and clearer reporting. Recharts powered the small, deliberately restrained data visualisations.

The beta also forced me to work on the parts founders often postpone: the public explanation, onboarding, feedback path, and product positioning. A monitoring engine could be technically correct and still fail as a product if people did not know what to connect or what they would receive when something went wrong.

## Product restraint

The service-monitoring market is full of mature tools. Observer was not an attempt to recreate every metric, log, trace, and integration they offered. Its edge was the experience of a stretched technical leader: someone looking after several products who needed the essential warning to be immediate and the interface to stay out of the way.

That led to a simple product principle: every screen and alert should reduce uncertainty. If a chart did not change a decision, it did not deserve space merely because the data existed.

## What I learned

Observer taught me that reliability tools sell peace of mind but earn trust through precision. A missed incident is dangerous; a flood of noisy alerts is only a slower way of making the tool irrelevant.

It also reinforced the value of using a product in the environment that created it. The strongest feature decisions did not come from a competitive matrix. They came from the moment between receiving an alert, diagnosing the issue, making a change, and seeing the service return.
