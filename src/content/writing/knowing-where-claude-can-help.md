---
title: "On the Importance of Knowing Where Claude Can Help, and Where It Can't (a.k.a. \"Decomposition\")"
description: "LLMs are probabilistic. Before handing a workflow to Claude, split it into what belongs to the model, what belongs to your existing system, and what belongs to a human."
pubDate: 2026-09-30
tags: [ai, architecture]
---

Large language models like Claude are probabilistic systems. It's easy to forget when you start interacting with one, yet it's a basic, crucial concept to keep in mind when architecting a Claude-based (no pun intended) solution: figure out where Claude can actually help. Some tasks are Claude's domain, others belong to the existing system Claude is being integrated into, and still others are exclusively human territory.

Consider a concrete example: automating refund requests for an online store. The naive approach is to hand the whole thing to Claude: "Here's the customer's email, here's our refund policy, process the refund." It will probably work most of the time, and that "probably" is exactly the problem. Let's decompose the workflow instead.

First, a customer writes in. The email might be polite, furious, rambling, written in broken English, or all of the above. Understanding what the customer wants, identifying the order number buried in the third paragraph, and noticing that they're also asking about a second item are tasks involving messy, unstructured language. This is where Claude shines, and where a traditional rules-based system would struggle.

Next, the order has to be looked up, and eligibility checked: Was it purchased within the last 30 days? Was the item already refunded? Is it a final-sale product? Then the refund amount must be calculated and the payment reversed. None of this should be left to a probabilistic system. These are deterministic operations with exactly one correct answer, and your existing backend already performs them reliably. Once the system returns a result, Claude comes back into play, drafting a clear, empathetic reply that explains the outcome in the customer's own language and tone.

Finally, some decisions belong to people. A refund of €2,000, a customer threatening legal action, or a case the policy simply doesn't cover shouldn't be settled by either Claude or the backend. These are escalated to a human, who takes responsibility for the decision.

The takeaway is simple: give each step of your pipeline to whatever handles it best. Let Claude do what it's good at, understanding and generating language. Let your existing systems own the rules, the data, and the transactions. And keep humans where judgment and accountability matter. No single component has to be perfect, because each one covers for the others' weaknesses. The result is a system more reliable than any of its parts, and when something does go wrong, you'll know exactly where to look.
