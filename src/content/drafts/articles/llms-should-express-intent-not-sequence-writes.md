---
draft: true
title: "LLMs should express intent—not sequence writes."
description: "A small shopping-list failure revealed a larger rule for reliable AI products: let the model propose the change and let the application own how it happens."
date: "2026-07-17"
imageUrl: /images/og-default.png
imageAlt: Social card for LLMs should express intent—not sequence writes.
imageWidth: 1200
imageHeight: 630
imageType: image/png
canonicalUrl: /articles/llms-should-express-intent-not-sequence-writes
---

A small failure in [Chef](/projects/chef) changed how I think about letting language models write to an application.

The user request was simple:

> Add Scrub Daddy sponges and paper towels.

The model translated that into two tool calls. Both were created from revision 4 of the shopping list.

The first call added the sponges and advanced the list to revision 5. The second call then tried to add the paper towels against revision 4 and correctly failed with a revision mismatch.

The model hadn't done anything especially strange. Optimistic concurrency was working as intended too: the application protected newer state from a stale write.

The mistake was mine: I had exposed an interface that required a probabilistic model to coordinate the sequence of database mutations.

That failure led to a principle I now use when designing AI-assisted write paths:

> **The model should express what the user wants. The domain should decide how that change happens.**

## One request is not necessarily one row

Traditional application APIs often grow around small CRUD operations:

```text
AddShoppingItem
UpdateShoppingItem
RemoveShoppingItem
```

Those operations are useful building blocks for a structured interface. A person presses one “add” button, the application performs one authorised mutation and the screen refreshes with the new state.

A conversation has a different shape.

Someone might say:

> Remove milk, double the eggs, add paper towels and make sure we have enough bananas for the week.

To the person, that is one instruction. If the model must turn it into a series of independent writes, the application has quietly made the model responsible for:

- ordering the operations;
- carrying revisions between calls;
- deciding whether later calls should continue after an earlier failure;
- preventing duplicate retries;
- keeping the final state consistent;
- explaining a partially completed request.

In this case, interpreting the instruction is the useful work for the model. Transaction coordination belongs somewhere deterministic.

## Expose a change set

Instead of giving the model a collection of row-level write tools, Chef can accept a single shopping-list intention:

```json
{
  "shopping_list_id": 1,
  "base_revision": 4,
  "idempotency_key": "message_8472938",
  "operations": [
    { "type": "remove", "item": "milk" },
    { "type": "set_quantity", "item": "eggs", "quantity": 24 },
    { "type": "add", "item": "paper towels" },
    { "type": "ensure_quantity", "item": "bananas", "quantity": 7 }
  ]
}
```

This is still structured output, but it describes a desired change rather than performing the change.

The application can then:

1. authenticate the actor;
2. authorise every operation;
3. resolve names against real items;
4. reject ambiguity;
5. validate quantities and household rules;
6. check the base revision;
7. lock the relevant aggregate;
8. apply the operations inside one database transaction;
9. create one revision and audit record;
10. return the resulting state to the model and interface.

If any required operation fails, the transaction can roll back. The shopping list is either updated coherently or not updated at all.

The model doesn't need to know how the database lock works. It shouldn't know which tables are involved. It doesn't decide when a revision is committed.

It says, in effect, “this is the change I believe the user requested”. The application remains the authority that can accept, reject or clarify the proposal.

## The three layers

I find the separation easiest to remember in three lines:

- **LLM layer:** here is the user's intent.
- **Domain layer:** here is the valid, authorised atomic change set.
- **Database layer:** here is the transaction that persists it.

Each layer has a different kind of responsibility.

The model handles language: interpretation, ambiguity detection, explanation and translating a human request into domain concepts.

The domain handles meaning: permissions, invariants, identity, quantities, state transitions and the rules that make the product trustworthy.

The database handles durability: transactions, locks, uniqueness, revisions and recovery from failure.

Collapsing those responsibilities into “the agent has tools” can produce a convincing demo. Keeping them separate produces a write path I can test, inspect and explain.

## Atomicity should follow the human action

There is another benefit: the history begins to reflect what the user actually did.

If three additions become three separate revisions, the history might read:

```text
Revision 4
Added Milo
Revision 5
Added paper towels
Revision 6
Added sponges
Revision 7
```

But the person made one request. A better record is:

```text
Revision 4
Added Milo, paper towels and sponges
Revision 5
```

That makes the audit trail easier to understand. It also gives undo a natural boundary.

“Undo my last change” shouldn't require the model to discover and reverse three loosely related mutations in the correct order. It should revert one change set whose boundary already matches the human action.

Atomicity is not only a database property. It is a product-design decision about which events belong together.

## Retries must be boring

Once a model can call an application across a network, ordinary network failures become part of the write path.

Imagine that the application successfully commits the shopping-list change, but the response never reaches the model. From the model's perspective, the tool call may have failed. Retrying is reasonable.

Without an idempotency key, a retry can add the same items again. With one, the application can recognise that `message_8472938` already produced revision 5 and return the original result without repeating the mutation.

The same principle is familiar in payment systems because charging a card twice makes the failure obvious. Duplicate pantry items are less catastrophic, but the architectural problem is identical.

Retries shouldn't require the model to reason about whether a hidden side effect might already have occurred. Give every consequential request a stable identity and make repeated delivery safe by default.

## Concurrency belongs below the conversation

Chef is intended for households. Two people may have the shopping list open at once. A background process may be deriving ingredients from a newly confirmed recipe while someone manually adds a staple.

Concurrency isn't an edge case created by AI. The conversation simply makes it easier to expose.

The model can include the revision of the state it used when preparing its proposal. The domain can then decide whether to:

- apply the change;
- safely rebase it onto the new state;
- reject it as stale;
- ask the model or person to resolve a conflict.

That choice depends on the operation. Adding an item may be safely mergeable. Replacing an entire meal plan may not be.

What matters is that the decision is deterministic and domain-aware. The model shouldn't discover halfway through a sequence of writes that the world has changed underneath it.

## Do not replace 20 tiny tools with one dangerous tool

There is a tempting overcorrection here.

If row-level tools are too granular, why not expose a single `MutateAnything` tool and let the model send arbitrary patches?

Because “express intent” doesn't mean “receive unlimited authority”.

A good change-set API speaks the language of the product:

```text
add_item
remove_item
set_quantity
mark_pantry_available
replace_meal
move_meal
```

It doesn't expose table names, raw SQL, unrestricted JSON Patch paths or internal columns. The operations should be narrow enough to validate completely and expressive enough to represent one real human request.

The domain still owns important distinctions. A dislike must not silently become an allergy. Removing an ingredient from this week's list must not erase a household preference. Replacing a recipe must not retroactively change the version used for a past meal.

The model can propose. The application decides what that proposal means in a system with history and consequences.

## The model is a planner, not the permission system

I don't describe the model as “untrusted” because I expect it to behave maliciously. I use the word because trust shouldn't be required for correctness.

The model can misunderstand a sentence. It can emit a duplicate operation. It can use a stale identifier, omit a field or confidently propose something the current user is not allowed to do. A web page, document or tool result can also contain instructions that were never authorised by the person.

None of those failures should be able to bypass the same rules used by the structured interface.

In Chef, agent tools should call the same authorised domain actions as buttons and forms. The AI doesn't get a second, more permissive route into the product merely because it communicates in JSON.

The application should be able to answer, for every write:

- Who asked for this?
- What human request led to it?
- Which state did the model see?
- Which operations were proposed?
- Which rules were evaluated?
- What actually changed?
- Can the change be reversed?

If those answers live only in a chat transcript, the product doesn't yet have an audit trail. It has a story.

## A practical design rule

When I add a conversational capability now, I want the write path to satisfy a simple sequence:

```text
one human request
→ one proposed intention
→ one authorised change set
→ one atomic transaction
→ one revision
→ one inspectable result
```

There will be exceptions. A long-running job may have several explicit stages. An external service may not support transactions. Some operations must pause for confirmation. But the exceptions should be visible product decisions, not accidental consequences of giving a model a bag of CRUD tools.

In this example, the model's useful work is interpreting messy human intent. That's enough responsibility.

Let the model propose **what the person meant**. Let ordinary, testable application code remain responsible for **what the system does about it**.
