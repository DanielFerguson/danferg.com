---
layout: ../../layouts/ProjectLayout.astro
title: Ferguson Livestock
description: A Murray Grey cattle stud and farm-direct beef venture built in Snake Valley, combining farm operations, decision-support software, brand, commerce, and fulfilment.
tags:
  - Agribusiness
  - Decision support
  - Brand strategy
  - Ecommerce
featured: true
period: 2022–present
status: Active venture
role: Co-founder / operations / brand / product & engineering
externalUrl: https://www.fergusonlivestock.com.au
externalLabel: Visit Ferguson Livestock
imageKey: ferguson-livestock
canonicalUrl: /projects/ferguson-livestock
---

## Why we started it

Ferguson Livestock is the commercial cattle operation and Murray Grey breeding stud that my wife, Tahlia, and I are building on our property in Snake Valley, Victoria. It began with a practical ambition: create something of our own in agriculture that could grow with us, carry our name, and connect the work happening in our paddocks directly with the people who value it.

The breeding and commercial sides of the business reinforce each other. The stud gives us a long-term focus on the quality, temperament, structure, and reputation of our cattle. The farm-direct beef business creates a much shorter relationship between producer and customer. Together they turn a property and a herd into a company with its own operations, identity, customers, and future.

## Building a company from the paddock up

The website is the visible part of Ferguson Livestock, but the work began well before a customer reached a checkout. We had to build and improve physical infrastructure, establish routines for managing the herd and property, form relationships with processors and suppliers, and understand how each stage would work from the farm through to a customer's freezer.

Selling meat directly also introduced a new set of responsibilities. We needed to understand the requirements around licensed processing, professional packaging, labelling, cold-chain handling, storage, transport, delivery, and farm pickup. Each decision had to work both on paper and on delivery day: the right product, kept at the right temperature, packed properly, matched to the right order, and handed to the right customer.

That made Ferguson Livestock a genuine zero-to-one company-building project. There was no single operating manual. We were learning how livestock, compliance, suppliers, packaging, logistics, customer communication, and cash flow fit together while building the system that joined them.

## Designing the direct-to-consumer model

We chose to sell through periodic beef drops rather than pretend a small farming operation has unlimited inventory. Customers can choose a 5kg or 10kg Murray Grey beef box, add any individual cuts available from the current batch, and select personal delivery across the Ballarat region or farm pickup by arrangement in Snake Valley.

The model sounds simple, but it has to reconcile two very different systems. Livestock becomes ready on an agricultural timetable; customers expect the clarity and speed of modern ecommerce. We need to communicate when a drop is coming, explain what a mixed box contains, release a finite amount of stock, prevent overselling, collect payment, coordinate fulfilment, and stay useful after the main boxes have sold out.

Designing around that reality led to a wait list, limited releases, live availability, separate sold-out states for boxes and additional cuts, and personal communication around delivery. Scarcity is not a marketing invention here. It is an honest reflection of the care, time, and finite supply behind each drop.

## The website as operating infrastructure

I designed and built [fergusonlivestock.com.au](https://www.fergusonlivestock.com.au) as more than a brochure. It is the connective tissue between the brand, the current inventory, payment, and the work we need to complete after an order arrives.

The site is built with Astro and TypeScript, with Stripe Checkout handling payment and Upstash Redis maintaining live stock and reservations. The ordering flow reserves limited inventory atomically so two customers cannot buy the same final box. It releases stock when a checkout is cancelled or expires, restores it when the payment lifecycle requires it, and changes the customer experience as boxes, individual cuts, or the entire drop sell out.

The public experience responds to those same operating states. When a drop is open, customers can order. When boxes are gone but other cuts remain, the site keeps those products available. When everything has sold, it returns to the wait list and prepares the audience for the next release. The website therefore shows the truth of the operation rather than requiring us to manually rewrite pages during a busy fulfilment window.

## Making the buying strategy inspectable

The customer-facing site helps us sell the finished product. I also built an internal [beef profitability calculator](https://github.com/DanielFerguson/beef-profitability) to improve one of the decisions that happens much earlier: which steers we should buy in the first place.

The calculator compares two strategies side by side. We can buy lighter yearling steers and carry them while they grow and finish, or pay more upfront for grown steers that are already closer to the target weight. Neither option is automatically better. A lower purchase price can be offset by more days on the property, more feed, slower-than-expected weight gain, and capital being tied up for longer. A heavier animal can shorten that window but leave less room for error in the purchase price.

The model makes those trade-offs explicit. We can change the number of cattle, starting and target weights, purchase price, average daily gain, minimum holding period, mortality, transport and processing costs, dressing percentage, boxed-beef yield and sale price. Feed assumptions include hay price, intake and wastage, along with the barley and lupin mix. The results update immediately to show days on the property, feed required, cost per kilogram gained, boxed-beef yield, profit per head, margin, and the break-even boxed-beef price for each strategy.

It also lets us move beyond a single optimistic estimate. Base, conservative, and optimistic cases show what happens when weight gain, yield, revenue, or feed costs shift together. Sensitivity tables then isolate changes in boxed-beef price, daily gain, grain prices, and target finish weight. Validation warnings surface assumptions that need another look rather than allowing a neat result to hide a weak input.

That matters more as our seasonal conditions become less predictable. Rainfall around our area directly affects pasture growth, supplementary feeding, the time cattle can be carried comfortably, and the cost of reaching a finish weight. The calculator does not try to predict the weather or replace judgement. It gives us a fast way to ask what a drier or more expensive season would do to a buying decision before we commit the capital.

The same discipline supports our longer-term work on the property. Tahlia and I are making a serious investment in soil health on ground that has seen little deliberate improvement for roughly 50 years. Soil sampling can show us the constraints and the available rectification pathways, but those improvements still have to be funded. Protecting the return on our cattle-buying decisions gives us more capacity to invest in the soil, pasture, and resilience that the operation will depend on over time.

I kept the calculator deliberately transparent: it is a static browser tool built with HTML, CSS, and JavaScript, with a generated spreadsheet version for working through the same model away from the browser. The aim is not to manufacture certainty. It is to put the assumptions in view, compare like with like, and make a consequential farm decision easier to challenge before it becomes an expensive lesson.

## Building the Ferguson Livestock brand

The brand needed to feel like us: ambitious about quality without becoming polished beyond recognition. We settled on **premium without pretence** and the line **Raised here. Delivered by us.** as two useful tests for the decisions underneath it.

That direction puts Tahlia and me in the story. Customers see the Snake Valley property, the cattle, the beef, and the people who will answer their questions and often deliver their order. Our cattle-show activity and Murray Grey breeding program provide real evidence of the standards we are working toward, while the farm-direct model keeps the promise personal and local.

My work has spanned the identity, positioning, photography, website, commerce experience, release messaging, wait-list journey, and the practical communication surrounding each drop. The strongest marketing has not been a slogan on its own. It has been making the entire experience—from a post announcing availability to the box arriving at a customer's door—feel recognisably Ferguson Livestock.

## Evidence of demand

Our most recent beef-box drop sold out within four minutes. For a young operation, that result was a powerful signal that the audience, offer, release process, and trust we had been building were working together.

The response after delivery mattered just as much. Customers have been enthusiastic about both the beef and the experience around it, giving us the kind of feedback that turns a one-off purchase into confidence about the next drop. We will publish attributed testimonials only where the customer has approved them; for now, the demand and repeat interest are the clearest evidence.

## What zero to one taught me

Ferguson Livestock has made the phrase "building a business" feel much more literal. Software can make a buying decision clearer, ordering calm, and inventory dependable, but it cannot improve soil, repair a fence, prepare cattle, satisfy processing requirements, pack a box, maintain a cold chain, or drive an order to someone's home. The value comes from making all of those parts work as one system.

It has also reinforced that trust is operational. Customers believe the story because they can see the farm and the people behind it, but that belief lasts only when the product, communication, payment, packaging, and delivery all honour the same promise.

## The broader ambition

We want to grow Ferguson Livestock carefully: strengthen the herd, build the reputation of the stud, improve each farm-direct release, and create a business that remains close to its customers as it becomes more capable.

The goal is not to imitate a supermarket or turn the farm into a faceless ecommerce operation. It is to build a durable agricultural company around good cattle, honest value, and personal service—one herd, one drop, and one customer relationship at a time.
