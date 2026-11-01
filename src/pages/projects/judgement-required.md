---
layout: ../../layouts/ProjectLayout.astro
title: Judgement Required
seoTitle: "Judgement Required: practical AI courses for work"
description: Practical AI courses for professionals who've been given Copilot, ChatGPT or Claude at work and now have to decide what to rely on.
tags:
  - AI at work
  - Online learning
  - Laravel
featured: true
period: 2026–present
status: Live site / courses in preparation
role: Founder / instructor / product & engineering
externalUrl: https://judgementrequired.com/
externalLabel: Visit Judgement Required
imageKey: judgement-required
imageAlt: "Judgement Required home page with the headline “AI is on your desk now. Judgement is still required.”, beside a black-and-white photo of Dan Ferguson speaking at a lectern."
caseStudyLabel: CASE STUDY // AI COURSES FOR PEOPLE WHO ANSWER FOR THE WORK
visualLabel: LIVE_SITE / HOME
canonicalUrl: /projects/judgement-required
publishedDate: "2026-11-02"
---

## Why I started it

**Judgement Required** is for professionals who've been given Microsoft 365 Copilot, ChatGPT or Claude at work. The licence comes with a login and, if they're lucky, a policy. The real questions start with the first real task: what is this good for in my job, what am I allowed to paste in, and if I send what it wrote, whose work is it?

It grew out of my time at [Communiti Labs](/projects/communitilabs), where we built AI-supported analysis tools with councils and government agencies. In 2025 those tools processed and analysed more than 2.5 million community contributions. That number shows a system working at scale. It doesn't show that every use of AI in it was worth it. Learning to tell the difference is what the courses teach.

## The tool comes third

The courses follow one method with four steps, always in the same order:

1. **Outcome.** Decide what a good result looks like, and who it's for, before opening the tool.
2. **Work.** Look at the whole job: what it depends on, who checks it and what can go wrong.
3. **AI.** Use it where it helps. Give it what it needs and nothing it shouldn't have.
4. **Evidence.** Compare the result with how the work was done before, counting the time spent checking and fixing. Then adopt it, revise it or stop.

The order is deliberate. Saving ten minutes on a draft means little if it costs someone else an hour, and sometimes a plain process fix does the job better than AI. The method doesn't depend on one product, so it works in whichever tool a workplace has approved.

## Two courses, one method

**AI Without the Magic** is the free introduction: 10 lessons and about 58 minutes, with a 41-minute route for people already using AI. Learners follow ordinary workplace tasks from the first request to a checked result.

**Redesigning Work with AI** is the paid course: 15 lessons and about three hours, for people who now have to show whether AI is improving the work. They trace one complete workflow, compare AI with other ways of improving it, and build the evidence to adopt, revise or stop.

Both courses are still being prepared, and enrolment isn't open yet. The articles are already live, including [four decision gates](https://judgementrequired.com/articles/should-your-business-use-ai) for a proposed use case and [a net-value calculation](https://judgementrequired.com/articles/calculate-ai-roi-hidden-operating-costs) that counts review, correction and maintenance as well as drafting time.

## Holding the courses to the same standard

A course about checking AI output has to show its own evidence, so three rules apply throughout:

- **Real exchanges, kept word for word.** The AI requests and responses in the lessons are real ChatGPT exchanges, including the mistakes and the corrections.
- **Fictional cases, clearly labelled.** Workplace sources and clients are invented so a whole piece of work can be shown, and they're labelled as fictional wherever they appear.
- **Claims that show their evidence.** Articles and lessons cite their sources, and figures from my own work say what they show and what they don't.

## Building the platform

I built the platform as a server-rendered Laravel application using Blade and Tailwind CSS, with framework-free JavaScript for small interactions. Articles, lessons and course outlines are Markdown and YAML files in the repository, and a content check reads every file the way the site does before anything is committed.

Course availability and prices come from runtime configuration and Stripe rather than page copy. The paid course can't be bought until it's published and its Stripe Price is confirmed as active, and the price a buyer sees is the price Stripe charges.

Lesson video runs on Cloudflare Stream, and playback only works for someone with access to that lesson. Accounts support Google sign-in, passkeys and authenticator-app two-factor. Learners who finish a course will get a certificate of completion, with a public page that confirms it's genuine.
