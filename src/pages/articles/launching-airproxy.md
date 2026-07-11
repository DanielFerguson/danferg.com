---
layout: ../../layouts/ArticleLayout.astro
title: "Launching Airproxy"
description: "I'm launching the first of my 12 startups in 12 months for 2023, and we're starting with Airproxy; a platform to help Airtable users scale fearlessly!"
date: "2023-01-02"
imageUrl: https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=720&q=60
canonicalUrl: /articles/launching-airproxy
---

Well, it's been a hot minute since I wrote a blog post (😬 whoops...), but I couldn't be more excited to write this one. I'm going to start the year as I intend to go on, and kick the year of 2023 off strong, with a product launch! Please welcome, [☁️ Airproxy!](/projects/airproxy)

![Airproxy CTA](/images/airproxy_cta.jpg)

## What's Airproxy?

Great question.

Airproxy is the result of working with Airtable for the better part of a few years, and constantly being amazed by their user experience offering, yet utterly disappointed when it comes to their API tooling.

For something that could really change how we manage content on a large scale, the Airtable team seems to love slapping a whole bunch of astericks around their cool features; only to tell us later that "hey, the API doesn't let you do that", "you can't use that, it's in beta" (_THEIR METADATA API WAS IN BETA FOR YEARS_ 😡) and "oh, no - we only support 5 API requests per second"... 🤦‍♂️

This has lead to many, including myself, to building ad-hoc proxy services that will do 'just enough' to allow us to get on with creating value for our users, whilst still adhering to their strict guidelines.

## Background

Whilst working at Imperial Wealth, I creating the proxy service that would cache the queries and responses between Airtable and our clients - trying to keep the house from catching on fire. The original version of this was built in Laravel, run on an AWS EC2 instance and had a lot of 'a hope and a prayer' keeping it together.

At the time, we had a pretty tight budget, and a mountain of other tasks in the roadmap that needed dedicated time and attention of all of our developers; the caching server felt more like a burden then it did an opportunity.

This lead to a lot of patches - features slapped on so that it got us over the line, but as soon as it worked, it was forgetten about; left to run, hoping that it wouldn't fall over if we got a major peak of traffic (Siri, queue "obvious foreshaddowing").

Well, not to beat around the bush, but it did fall over. A couple of times. Saturday mornings were the worst, when ~90% of our entire userbase was active on the site, making requests every few seconds for new data - data that was hosted on Airtable. The industry experts were simultaniously updating Airtable, which in turn busted the cache, replacing the contents, ready to serve the hungry, hungry hippos of client devices. I remember a good number of times where I would need to log on to manually restart the server, increase the size again, or do something to patch it so it would work.

## Why build Airproxy?

Now - could we have done a better job? Absolutely... technically. I am very proud of how much myself and the small team of developers achieved there, and there was no way we had the resources to spend rearchitecting and rebuilding the caching server.

However, now having left Imperial Wealth I've since had a lot of time to think about what we did right, what we could have done better, and how we could have used different technology stacks to enable higher levels of scalability, whilst keeping costs low.

All of these thoughts lead me to start tinkering...

Initially, I took to Google to see if anyone else had these kinds of issues with Airtable, and I was not suprised to see that the Airtable forum was filled with people sick of the sub-par service. The one that caught my eye the most was a thread regarding [one of Airtable's major changes to their service](https://support.airtable.com/docs/changes-to-airtable-attachments) - they were getting rid of the support for serving static files.

I get that for non-technical people, this just sounds like words smushed together, but what it meant was Airtable no longer let us host files like images, videos, and audio files. I don't know about you, but the internet is pretty boring without those kinds of assets.

However, Airtable's... _ahem_ misstep, was just another opportunity for me to fix. This, along with a number of other features I could have only dreamed of made up the MVP of Airproxy. So, I got to work.

Over the past few weeks, I have been tinkering away at this platform, and I am so excited to say that it's offically ready for launch!

![Airproxy CTA](/images/airproxy_screenshot.webp)

## What next?

Like most founders, I've got a swathe of features that I want to work on - but those are really not necessary. However, I've also deadlines. If you don't already know, I am creating 12 startups in 12 months, so as you can imagine, time is of the essence!

With yFocus, Observer, and another few projects coming into out of the ideation stage and into prototyping, I'll need to resign myself to the fact that I won't be able to get them done as fast as I would like. On top of those projects, I am also working heavily on marketing and search engine optimisation for Airproxy.

If you want to keep up to date with Airproxy though, we've got a [Twitter](https://twitter.com/airproxyapp), [LinkedIn](https://www.linkedin.com/company/airproxyapp/), and [TikTok](https://www.tiktok.com/@airproxy) here for you! This will be my first startup with a co-founder (go check out [Luke Bone](https://www.linkedin.com/in/lukeboneme/), he's a content whiz!), so I am very excited to see how we work together, and the discoveries we find in our journey to help Airtable users take their data into production, fearlessly.
