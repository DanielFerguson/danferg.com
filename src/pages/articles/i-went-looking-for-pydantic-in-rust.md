---
layout: ../../layouts/ArticleLayout.astro
title: "I went looking for Pydantic in Rust"
description: "I went looking for a Rust equivalent to Pydantic and found a more interesting answer: Rust changes where validation lives."
date: "2026-07-20"
imageUrl: /images/og/articles/i-went-looking-for-pydantic-in-rust-og.png
imageUrls:
  - /images/og/articles/i-went-looking-for-pydantic-in-rust-16x9.png
  - /images/og/articles/i-went-looking-for-pydantic-in-rust-4x3.png
  - /images/og/articles/i-went-looking-for-pydantic-in-rust-1x1.png
imageAlt: Social card for I went looking for Pydantic in Rust
imageWidth: 1200
imageHeight: 630
imageType: image/png
canonicalUrl: /articles/i-went-looking-for-pydantic-in-rust
---

For the past three years, most of the AI tooling, agent harnesses and platforms I have built have been written in PHP.

PHP will always have a special place in my heart. But every time I spend time in a language with stronger static guarantees—Go or Rust—I fall in love all over again. No amount of Larastan, even at its strictest, gives me quite the same peace of mind as a compiler that simply refuses to let an entire class of mistakes through.

That is a large part of Rust's appeal to me. The idea—perhaps the sales pitch—that code I write today could still be compiling and running reliably a decade from now has a strong pull. There is comfort in a language designed to make change safer, especially when the software itself may need to outlive the fashions surrounding it.

Over those same years, I have watched the AI ecosystem fall in love with Python. The result has been a flood of frameworks and tools that caught my attention: LangChain and LangGraph, LlamaIndex, DSPy, AutoGen and Pydantic, among many others.

Some have matured. Some have been replaced or absorbed into the next abstraction. The attention has moved quickly from one to another, usually accompanied by an impressive number of Hacker News commenters valiantly defending whichever framework is having its moment.

Of all of them, Pydantic was my early bet. It was aimed at a problem I cared about: taking flexible, uncertain input and turning it into something an application could trust.

Pydantic solves a useful problem in Python. You describe the shape of the data you expect using type annotations, then Pydantic handles the work of turning untrusted input into something the rest of your program can use with much more confidence. It can parse values, coerce compatible types, apply validation rules and return detailed errors when the input doesn't fit.

But I kept wanting the same idea lower in the stack. I wanted something compiled, fast and safe by construction—not only a stronger runtime check around a dynamic language.

That led me to a fairly literal question:

> What is the Rust-native version of Pydantic?

The first answer was mildly amusing. [Pydantic v2's core validation logic is already written in Rust](https://pydantic.dev/articles/pydantic-v2). Its `pydantic-core` package uses Rust to do much of the parsing, validation and serialisation behind Pydantic's Python interface.

That makes Pydantic Rust-powered. It doesn't make it a general-purpose Rust validation library, though. More importantly, I was beginning with the wrong comparison.

## The language has already done some of the work

Python is dynamic. A type annotation can tell developers and tooling that a value is expected to be a string, but Python does not ordinarily enforce that annotation when the program runs. Data arriving from an API, configuration file or user can have the wrong shape, and even an object already moving through the program may not satisfy the assumptions implied by its annotations.

Pydantic adds that runtime enforcement. It takes data that Python is willing to accept and checks whether it can become the model the application expects.

Rust begins from a different position. It is statically typed: [the compiler must know the type of each value at compile time](https://doc.rust-lang.org/book/ch03-02-data-types.html). If a struct says that `name` is a `String` and `age` is a `u8`, code cannot later put `None` into `name` or quietly replace `age` with a string. A function that expects a `User` cannot accidentally receive an unrelated value and hope for the best.

Once data has successfully become a Rust type, its basic shape remains trustworthy.

This is the part that changed my mental model. I had been looking for a library to keep checking guarantees that the language and compiler were already designed to preserve.

## Serde gets the data across the boundary

Of course, the outside world isn't made of valid Rust structs.

HTTP requests still contain bytes. JSON can be malformed. A required field can be missing, a number can arrive as text, or a value can be outside the range its Rust type can represent. The compiler cannot inspect tomorrow's API request while compiling today's program.

That is where [Serde](https://serde.rs/) fits. Serde is a framework for serialising and deserialising Rust data structures. With a format implementation such as `serde_json`, it can attempt to turn external JSON into a type defined by the program. If the JSON does not have a compatible shape, deserialisation fails instead of allowing a half-valid value to wander further into the application.

The flow looks something like this:

```text
untrusted JSON
    ↓
Serde deserialisation
    ↓
semantic validation or domain conversion
    ↓
trusted Rust type
    ↓
business logic
```

That middle step matters. Serde can establish that `age` is a number that fits into a `u8`. It cannot decide that this particular application only accepts adults.

```rust
use serde::Deserialize;

#[derive(Deserialize)]
struct UserInput {
    name: String,
    age: u8,
}

struct AdultUser {
    name: String,
    age: u8,
}

impl TryFrom<UserInput> for AdultUser {
    type Error = &'static str;

    fn try_from(input: UserInput) -> Result<Self, Self::Error> {
        if input.age < 18 {
            return Err("user must be at least 18");
        }

        Ok(Self {
            name: input.name,
            age: input.age,
        })
    }
}
```

`UserInput` represents data that has the right technical shape. Converting it into `AdultUser` establishes the rule the domain actually cares about. If construction of `AdultUser` is kept behind that conversion, other parts of the application can accept an `AdultUser` without checking the age again.

The validation has not disappeared. It has been concentrated at the point where uncertain external data becomes a trusted domain value.

## Types are not business rules

This is the qualification that prevents the idea from becoming too neat.

Rust can guarantee that a value is a `String`. It cannot guarantee that the string is a real email address. It can guarantee that a date has the representation required by its type. It cannot know that an end date must occur after a start date. It can prevent an `Option<T>` from being treated as a `T` without handling the possibility of `None`, but it cannot decide whether a missing value makes commercial sense.

Those are runtime and domain questions.

They can be handled with explicit conversions such as `TryFrom`, constructor functions that protect their invariants, newtypes that make invalid states harder to represent, or validation crates such as [Garde](https://docs.rs/garde/latest/garde/). A larger API may also add JSON Schema or OpenAPI tooling around the same types.

There is no single mandatory Rust package that must own all of this. That initially looked like fragmentation to me. I now think it reflects a useful separation of responsibilities:

- Serde handles the movement between external formats and Rust data.
- Validation logic decides whether well-shaped input is acceptable to the domain.
- Domain types capture the guarantees the rest of the program should be able to trust.
- The compiler prevents later code from casually violating the types those decisions produced.

Pydantic bundles more of that experience together because Python needs a runtime layer to create and maintain trust around dynamic data. Rust can afford to spread the work across the boundary, the domain model and the language itself.

## The better question

I started by asking which Rust crate could replace Pydantic.

The more useful question is: **where does uncertain data become trustworthy in a Rust program?**

Sometimes the answer will be Serde alone because shape is the only requirement. Sometimes it will be Serde followed by a validation crate. In domain-heavy software, it may be a deliberate conversion from a permissive input type into a much narrower type that makes an important invalid state impossible to express.

Rust doesn't eliminate validation, and its compiler cannot prove that data from the outside world is honest, sensible or commercially valid. What it changes is how much of that uncertainty needs to survive after the boundary has been crossed.

That is more interesting than finding a one-for-one Pydantic equivalent. The goal is not to keep asking whether every value is valid. It is to decide where that question must be answered, encode the answer in a type, and let the compiler help preserve it from there.

One final caveat: I'm still a novice Rust user, and I wouldn't describe myself as a Python expert either, so take this with the appropriate grain of salt. This article reflects my practical understanding of both languages and how their core tools divide responsibility inside AI applications. There are undoubtedly nuances I have missed, and I expect this mental model to change as I build more with both.
