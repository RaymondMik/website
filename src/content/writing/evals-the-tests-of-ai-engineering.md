---
title: "Evals: The Tests of AI Engineering"
description: "Evals are to LLM-based systems what tests are to traditional software: a dataset, a way to score the output, and three ways to grade it."
pubDate: 2026-10-06
tags: [ai, testing]
---

Tests are a crucial part of software development, and evals (short for evaluations) play the same role in AI engineering. When you build an LLM-based system, evals are the structured tests that check whether it returns the correct output, where "correct" means both expected and accurate.

There is one big difference. Traditional code is deterministic: the same input gives the same output, so a test either passes or fails. LLMs are probabilistic, and their answers vary in wording, length and quality. Evals have to handle that fuzziness, which is what makes them both harder and more interesting.

## Why evals matter

The obvious goal is to catch problems before a system reaches production. A prompt that works on the five examples you tried by hand can still fail on the sixth one a real user sends.

But evals do more than catch bugs. They turn every change into a measurable experiment:

- **Swapping a model.** Is the newer, cheaper model as accurate as the one you use today?
- **Editing a prompt.** Did adding "answer in one sentence" make responses shorter but less correct?
- **Changing retrieval.** Does a new chunking strategy surface the right documents more often?

Without evals, these questions get answered by gut feeling. With evals, you get a number: "accuracy went from 82% to 89%."

## The two ingredients: a dataset and a score

Every eval needs two things.

**A good dataset.** This is a set of realistic inputs, ideally paired with the expected output. For an invoice-extraction system, it might be 200 real invoices with their known totals, dates and vendor names. Include the easy cases, the messy ones (scanned, handwritten, multi-currency) and the edge cases that have broken things before.

**A way to score the output.** Knowing what you expected isn't enough; you need a reliable way to decide how close the system got. Sometimes that's a simple comparison. Sometimes it takes judgment, and that's where a scoring rubric helps: clear criteria and a description of what each score means.

## Three ways to grade

**1. Code-based evals: use them whenever possible.** If correctness can be checked by a program, let a program check it. It's fast, cheap and gives the same result every time. Examples:

- The extracted invoice total equals 1240.50, within a tolerance of 0.01.
- The output parses as valid JSON and matches the expected schema.
- A support-ticket classifier returns one of the five allowed categories.
- A generated SQL query runs without errors and returns the expected rows.

**2. Model-based evals: when interpretation is needed.** Some qualities can't be checked with a regex, like tone, helpfulness or whether a summary stays faithful to its source. Here you ask another LLM to act as a judge, giving it the input, the output and a rubric. For example: "Score 1 to 5: does the summary contain only claims supported by the source document?" The judge is a model too, so check its scores against human ones before you trust it.

**3. Human review: the ground truth.** People are slow and expensive graders, but they catch what automated checks miss and define what "good" really means. Use them to label your dataset, to calibrate model judges, and to spot-check production. Reviewing a sample of 50 real conversations each week is a common habit.

| Method | Best for | Speed and cost | Trade-off |
| --- | --- | --- | --- |
| Code-based | Exact facts, formats, structure | Fast, nearly free | Can't judge nuance |
| Model-based | Tone, relevance, faithfulness | Fast, moderate cost | Judge can be biased or wrong |
| Human review | Ground truth, calibration | Slow, expensive | Doesn't scale |

## Getting started

You don't need a huge framework to begin:

- **Start small.** Twenty to fifty well-chosen examples beat zero.
- **Automate first.** Write code-based checks for everything they can cover, and add a model judge only where you need one.
- **Run evals on every change**, just like a CI test suite, and track the score over time.
- **Feed failures back.** Every bug found in production becomes a new test case.

Software engineers learned long ago that untested code is broken code you haven't caught yet. The same is true for AI systems.
