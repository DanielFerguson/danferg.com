---
layout: ../../layouts/ProjectLayout.astro
title: StudList
description: A free Australian cattle-industry marketplace my wife and I created to help people advertise livestock, genetics, equipment, hay, and services without the fees of larger platforms.
tags:
  - Agricultural technology
  - Marketplace
  - Product engineering
featured: true
period: "2026"
status: Active marketplace
role: Co-creator / product / engineering
externalUrl: https://studlist.com.au/
externalLabel: Visit StudList
imageUrl: /assets/projects/studlist/screenshot.webp
canonicalUrl: /projects/studlist
---

## A marketplace we wanted to exist

StudList began with a simple observation my wife and I shared: the people who breed cattle, produce hay, supply genetics, make equipment, or offer specialist services should not need a large marketing budget just to be discoverable.

The cattle industry has established sales channels, but many online platforms are built around listing fees, transaction costs, or packages better suited to larger operations. Those economics can make sense for a major sale. They are a much harder fit for a small stud, an independent service provider, or someone with one useful item sitting in the shed.

We created StudList as a practical alternative—an Australian marketplace where people can advertise what they have, buyers can find it, and every listing category is free to publish.

## Making participation the product

Removing the listing fee was not a promotional offer added after the marketplace was built. It shaped the product from the beginning.

A seller can create an account, add the information buyers need, publish immediately, and receive enquiries directly. StudList does not need to insert itself into the conversation or make a simple listing feel like a formal auction campaign. Its job is to make the connection possible.

That changes who can reasonably participate. A breeder can present an individual animal or genetics package. A fitter, photographer, livestock transporter, or other specialist can make a service visible. Equipment and hay that might otherwise circulate only through local word of mouth can reach people further away.

Free listings lower the risk of trying the platform, but the larger idea is access: useful supply should not remain invisible because promoting it costs too much.

## Built around the industry, not a generic classifieds form

Cattle listings carry details that a general marketplace does not understand. A buyer may care about breed, colour, age, sire, dam, registration, location, storage, condition, or the way something has been prepared. A useful agricultural marketplace needs to preserve that context without making the seller complete an exhausting form.

StudList supports six connected categories:

- **Steers** for commercial cattle and direct sale information.
- **Stud stock** with breeding, identification, and registration details.
- **Genetics** including semen and its storage location.
- **Equipment** used around showing and cattle operations.
- **Services** from the people and businesses that support the industry.
- **Hay** with agricultural details that go beyond an ordinary product listing.

Each category has its own structured workflow, while search brings the marketplace back together through filters such as type, breed, location, price, and recency. The data model respects the differences without turning StudList into six separate products.

## Designed for a direct connection

StudList is intentionally closer to a noticeboard than a broker. Listings combine photographs, practical specifications, seller information, and location so a buyer can decide whether to start a conversation. From there, the parties deal directly.

That simplicity matters in a rural context. People may be publishing from a phone, taking photographs in the paddock, or checking listings between other jobs. The public marketplace is responsive, browsing does not require an account, and the path from discovery to contact stays short.

Trust comes from legibility rather than ceremony. Clear categories, relevant details, visible contact information, and consistent listing pages help a buyer understand what is being offered without StudList pretending to guarantee a transaction it does not control.

## What we built together

StudList grew from a shared idea into a working marketplace. Together, my wife and I shaped the proposition, the categories, and the experience we wanted the cattle community to have. My work focused on turning that into the product: architecture, listing workflows, search, accounts, administration, responsive interface design, and the infrastructure needed to operate it.

The application is built with Laravel and Tailwind CSS, with server-rendered public pages that keep the browsing experience direct. It includes category-specific creation and editing flows, image uploads, authentication, seller dashboards, policy-based ownership controls, searchable public listings, and a Filament administration panel for overseeing the marketplace.

The technology is conventional by design. The hard part of a marketplace is rarely choosing an exotic stack; it is expressing the domain clearly, removing friction for one side, and giving the other side enough useful supply to return.

## Learning about marketplace gravity

StudList reinforced that a marketplace cannot be judged by the number of forms it contains. Its real product is the possibility of a connection that would not otherwise happen.

That makes growth a human problem as much as a software one. Sellers need a reason to list before a large audience exists, while buyers need enough relevant supply before browsing becomes a habit. Making participation free removes one barrier, but it does not remove the work of earning trust, attracting quality listings, and staying useful to a specialised community.

Building StudList with my wife has made the project especially meaningful. It combines our ideas about fairness and practical access with a product rooted in a real Australian industry. Its ambition is deliberately straightforward: help good cattle, useful equipment, quality feed, genetics, and skilled people become easier to find.
