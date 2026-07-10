---
layout: ../../layouts/ProjectLayout.astro
title: Guardian
iconUrl: /assets/projects/guardian.svg
description: A privacy-first COVID exposure-warning prototype that kept a person's location history on their device while checking it against rapidly changing public exposure-site data.
tags:
  - Civic technology
  - Privacy engineering
  - Mobile
featured: true
period: "2021"
status: Archived prototype
role: Creator / product / full-stack engineering
externalUrl: https://github.com/DanielFerguson/useguardian.app
externalLabel: View source
imageUrl: /assets/projects/guardian/screenshot.webp
canonicalUrl: /projects/guardian
---

## The problem

During the COVID-19 pandemic, exposure-site lists could change faster than people could reasonably monitor them. The official process relied on a person remembering where they had been, repeatedly checking public announcements, and recognising that one of hundreds of places and times matched their own movements.

Speed mattered, but so did trust. A conventional contact-tracing service could make matching easier by sending location history to a central database; it could also create a highly sensitive record of where people had been. Guardian explored a different trade-off: **could the matching happen without collecting that history centrally?**

## A local-first approach

Guardian was designed as a cross-platform mobile app that recorded location history on the person's phone. The server distributed public exposure-site information, while the private comparison happened on the device.

The intended flow was deliberately straightforward:

1. Guardian recorded relevant location history locally, with the user's permission.
2. A Laravel service checked Victoria's public exposure-site feed every five minutes and normalised new locations.
3. Firebase messaging notified installed apps when the public dataset changed.
4. Each phone compared the new site and time against its own local history.
5. If a possible overlap appeared, Guardian prompted the person to check official advice, test, and isolate as appropriate.

The server needed to know that an exposure site existed. It did not need to know whether a particular person had visited it.

## What I built

Guardian was more than a landing-page concept. The prototype covered the three parts needed to test the idea end to end:

- A Flutter mobile application for iOS and Android, including location permissions, background tracking, local history, exposure warnings, and controls for deleting recorded data.
- A Laravel API that ingested and cached public exposure sites, geocoded locations, and published updates.
- A Next.js website that explained the privacy model and tested the proposition with individuals, businesses, and government audiences.

The interface kept the product intentionally calm. Contact tracing was already frightening and cognitively heavy; the app needed to explain permissions, show whether an exposure had been detected, and make the next step obvious without creating another source of alarm.

## Privacy as an architecture decision

Guardian's strongest idea was that privacy should be visible in how the system works, not left to a policy page. Location history stayed on the phone. Users could inspect and erase it. The backend distributed public facts rather than collecting private movements.

That approach also imposed real constraints. Background location permissions are difficult, mobile operating systems behave differently, and public datasets are not always shaped for automated use. The prototype had to make those limitations explicit: Guardian was not an official health service and could not replace government advice.

## What I learned

Guardian reinforced that trustworthy products often begin by deciding what data **not** to collect. Centralising information can make an engineering problem easier while making the human problem much worse.

It also showed how quickly a civic product can move from software into questions of consent, accessibility, public communication, and institutional responsibility. The most valuable outcome was not a claim that an app could solve contact tracing. It was a working demonstration that speed and privacy did not have to be treated as opposites.
