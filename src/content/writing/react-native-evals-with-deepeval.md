---
title: 'Adding an eval suite to a React Native app with DeepEval'
description: 'Unit tests can tell you whether an LLM reply parses. They can’t tell you whether it’s any good. Here’s how I added a DeepEval suite to an Expo app, how the LLM judge works under the hood, and how I read the results.'
pubDate: 2026-11-23
tags: [ai, testing, react-native, llm-engineering]
---

Catchword is a vocabulary app I'm building with Expo and React Native. You collect words, then practise them. For a new practice mode, I'm trying something more ambitious than multiple choice: Claude writes a fill-in-the-blank sentence for each word, translates it, and suggests three wrong answers.

My Jest suite tells me whether Claude's reply parses and passes the app's validation. It can't tell me whether the sentence sounds natural, whether the translation is right, or whether one of the "wrong" answers would also fit the blank. Those are questions about quality, and you need evals to answer them.

This post covers how I added an eval suite with [DeepEval](https://github.com/confident-ai/deepeval)'s TypeScript SDK, what happens under the hood when it judges an output, and how I read the results.

## Unit tests and evals do different jobs

I kept both, and they don't overlap:

- **Jest** (`npm test`) covers the deterministic part: parsing Claude's JSON, checking that the sentence contains the word exactly once, building the blanked sentence, falling back to classic practice when an item is invalid. It's fast, free and runs on every commit.
- **DeepEval** covers the part that isn't deterministic: is the output *good*? An LLM judge scores each output against criteria I wrote. It's slow, costs money and gives slightly different scores from run to run.

One design decision made the evals easy to write: **the pure logic lives in `lib/`, separate from the API call.** `generatePracticeSentences()` takes the function that calls Claude as a parameter. The app passes the real request. The eval passes the same request wrapped in a tracing span. No mocks, no special test code paths.

## Setup

DeepEval's TypeScript SDK runs on **Vitest**, not Jest, so evals get their own test runner. That turned out to be a feature: the two suites can't get mixed up.

```bash
npm install -D deepeval vitest
```

A Vitest config used only by the evals:

```ts
// vitest.config.ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Only for the DeepEval suite in tests/evals (run via `npx deepeval test run`).
// Unit tests stay on Jest (`npm test`), which ignores tests/evals.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) }, // same path alias as the app
  },
  test: {
    include: ['tests/evals/**/*.test.ts'],
  },
});
```

The suite lives in its own folder:

```
tests/evals/
  sentence-practice.test.ts  # runs each test case and traces the Claude call
  metrics.ts                 # metrics and their pass thresholds
  .dataset.json              # test cases: language pair + words to practise
```

One snag: the version I used (deepeval 0.9.26) augments Vitest's `Assertion` type in a way Vitest 4 didn't pick up, so `expect(golden).toPass(...)` didn't typecheck. A small `.d.ts` file that redeclares the matcher fixed it.

There's also `npx deepeval setup`, which starts an AI agent that builds the suite for you and runs it once. I used it as a starting point. Fair warning: while the eval runs, its terminal shows nothing but "Thinking…" for several minutes. It isn't stuck. If you want proof, watch the run's results file in `.deepeval/` grow.

## The dataset

Each test case ("golden" in DeepEval's terms) is one practice session: a language pair and a handful of words.

```json
{
  "input": "{\"sourceLang\": \"es\", \"targetLang\": \"en\", \"words\": [{\"id\": 1, \"word\": \"gato\", \"translation\": \"cat\"}, ...]}"
}
```

I have 20, spread across Spanish, German, French, Italian and Portuguese, with a mix of nouns, verbs and words with more than one meaning. They load with a top-level `await`, so the cases exist when Vitest collects the tests:

```ts
const dataset = new EvaluationDataset();
await dataset.addGoldensFromJSON({ filePath: 'tests/evals/.dataset.json' });
```

## Tracing: judge each step, not just the end result

You could score only the final output. But when a case fails, you want to know *where* it went wrong. DeepEval's `observe()` wraps a function in a span, and each span can carry its own metrics.

I trace two levels. The inner span is the single Claude call:

```ts
const sentenceLlm = observe({
  type: 'llm',
  name: 'requestSentenceReply',
  model: 'claude-sonnet-5-5',
  metrics: SENTENCE_LLM_SPAN_METRICS,
  fn: async (system: string, user: string): Promise<string> => {
    const reply = await requestSentenceReply(system, user);
    updateCurrentSpan({ input: `${system}\n\nWords: ${user}`, output: reply });
    return reply;
  },
});
```

The outer span is the whole practice session, as the app runs it, including parsing, validation and fallback:

```ts
const practiceSession = observe({
  type: 'agent',
  name: 'generatePracticeSentences',
  fn: async (input: string): Promise<string> => {
    const { words, sourceLang, targetLang } = JSON.parse(input);
    const result = await generatePracticeSentences(words, { sourceLang, targetLang }, sentenceLlm);
    const output = describeSession(words, result); // what the learner would see
    updateCurrentSpan({ input, output });
    updateCurrentTrace({ input, output });
    return output;
  },
});

it.each(dataset.goldens)('practice sentences: $input', async (golden) => {
  await expect(golden).toPass(TRACE_METRICS, { task: (g) => practiceSession(g.input) });
});
```

Notice that `practiceSession` passes `sentenceLlm` straight into the real `generatePracticeSentences()`. That's the dependency injection paying off.

The split also tells you where to look. If the Claude-call metrics pass but the session metrics fail, the problem is in my code after the reply, not in the prompt.

## Metrics

Most of my metrics are **GEval**: you describe in plain English what "good" means, and an LLM judge scores the output from 0 to 1 against that description.

```ts
new GEval({
  name: 'Fair Distractors',
  criteria:
    'Each item has three wrong words meant as distractors for a multiple-choice blank. ' +
    'Judge whether they are distinct, in the source language, the same part of speech and form ' +
    'as the given word, believable at a glance, and none of them would also complete the sentence correctly.',
  evaluationParams: [SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
  threshold: 0.7,
});
```

The full set:

- **The Claude call:** Answer Relevancy (built in) and Translation Fidelity (GEval).
- **The whole session:** Task Completion (built in), Learner-Ready Sentences (GEval) and Fair Distractors (GEval).

Write criteria the way you'd brief a human reviewer. Be specific about what to penalise. "Penalise sentences where another choice would fit equally well" works much better than "distractors should be good".

Not everything needs an LLM. An earlier version of the suite used `PatternMatchMetric`, a plain regex, to fail any session where a word fell back to classic practice. It's free, instant and deterministic.

## Running it

```bash
npx deepeval test run tests/evals/sentence-practice.test.ts \
  --identifier sentence-practice --max-concurrent 4 \
  --skip-on-missing-params --ignore-errors
```

Each test case makes one Claude call plus around ten calls to the judge (a GEval makes two: one to plan its evaluation steps, one to score). With 20 cases, a run takes about seven minutes and costs real money on two API bills. Useful flags:

- `-d failing` lists only the failing cases at the end.
- `-v` prints each metric's step-by-step reasoning.
- `-c` reuses cached results for unchanged cases.

## Reading the results

You don't need an account with Confident AI (the company behind DeepEval). Everything can stay on your machine:

1. **The terminal table.** At the end of a run you get every case and metric with its score, threshold and pass/fail, then the overall pass rate.
2. **`npx deepeval inspect`.** This is the one I actually use. It opens the latest run in an interactive terminal UI, where you can step through each trace (session, then the Claude call) and see the input, the output, every score and the **judge's reason** for it.
3. **Raw JSON.** `.deepeval/.latest_test_run.json` holds the full last run. Set `DEEPEVAL_RESULTS_FOLDER=eval-results` and every run is also saved with a timestamp, so you can compare before and after a prompt change. `npx deepeval inspect -f eval-results` opens the newest one.

Add `.deepeval/` to `.gitignore`. It's per-run scratch output, and it builds up quickly.

## Under the hood: who is the judge?

My metrics don't name a judge model, so I wanted to know who was grading Claude's homework. The answer is in `node_modules/deepeval`:

1. On import, DeepEval loads `.env`, `.env.<APP_ENV>` and `.env.local` into `process.env`. Real environment variables win.
2. When a metric is constructed without a `model`, DeepEval checks for a `USE_*_MODEL` setting (`USE_ANTHROPIC_MODEL`, `USE_GEMINI_MODEL`, …). If none is set, it **falls back to OpenAI**.
3. The OpenAI model is `options.model`, else `OPENAI_MODEL_NAME`, else the registry default (`gpt-5.4` in my version). The key is `OPENAI_API_KEY`.
4. On the first judgement it creates a client with the official `openai` SDK and calls `chat.completions.create()` with a JSON schema for the structured score.

So the default setup is **Claude generates, GPT judges**, and I'm keeping it that way. Using a judge from another vendor reduces the risk of a model favouring its own style. If you'd rather use one vendor, pass `model: new AnthropicModel(...)` to a metric, or set `USE_ANTHROPIC_MODEL=true`.

## Is my API key safe?

DeepEval reads your OpenAI key, so it's fair to ask where else it goes. I read the package source to check. In 0.9.26:

- **The key is used in one place:** creating the OpenAI client. Nothing serializes model objects or dumps `process.env`, and the results only record the judge model's *name*.
- **Confident AI** (their cloud) only receives data if you log in. Even then it gets your eval data (prompts, outputs, scores, reasons), not your provider keys.
- **Telemetry** goes to PostHog: an anonymous ID, the SDK version, metric names, case counts and the provider/model name. It's on by default. Set `DEEPEVAL_TELEMETRY_OPT_OUT=1` to turn it off.

Two caveats: `deepeval setup` downloads a compiled helper binary I couldn't audit the same way, and I didn't audit the `openai` and `posthog-node` dependencies. For certainty, run an eval with a network monitor and check that you only see `api.openai.com`, `api.anthropic.com` and (until you opt out) `us.i.posthog.com`.

## When a test fails, don't touch the prompt first

A red eval doesn't automatically mean the prompt is wrong. The judge is an LLM too. Open the failing case in `deepeval inspect`, read the judge's reason next to the actual output, and decide what kind of failure it is:

| What you see | Fix |
| --- | --- |
| The sentence really is bad | The prompt (or model, or temperature) |
| Claude's reply was fine, but the word fell back to classic practice | The app's validation code, plus a unit test |
| The output is fine, but the judge marked it down | The metric's criteria or threshold |
| The test case itself is wrong | The dataset |

Then rerun the case two or three times. Scores move between runs, and a case scoring 0.65 one run and 0.8 the next is noise around the threshold, not a regression. When you do change the prompt, change one thing, rerun the **whole** suite, and phrase the fix as a general rule rather than writing to the failing test case.

## Running evals in CI

Evals fit in a pull-request workflow, with some care:

- **Run them only when relevant.** Use path filters on the prompt, the validation code and `tests/evals/`, plus `workflow_dispatch` for manual runs. Add a `concurrency` group so a new push cancels the old run instead of paying for both.
- **Store both keys as repo secrets** and map them to the variable names your code expects.
- **Start in report-only mode** (`continue-on-error: true`). Make it a required check once you know how much the scores vary between runs.
- **Upload the results as a build artifact**, so you can download a run and open it with `npx deepeval inspect <file>`.

## A note on API keys in mobile apps

This feature is a proof of concept. The app calls Claude directly with a key from `.env`, and anything with an `EXPO_PUBLIC_` prefix is bundled into the app, where anyone can extract it. That's fine on a branch on my machine and not fine in the App Store. If the feature ships, the call moves behind a small backend. Since the eval wraps the request function rather than the app, the suite won't need to change much when that happens.

## Wrapping up

Adding the suite took an afternoon, and it changed how I work on the prompt. Before, I'd change it, try two or three words in the simulator and decide by gut feeling whether it was better. Now I change it, run the suite, and compare scores across 20 sessions in five languages. That's still not proof, because the judge is an LLM, but it's a lot better than my gut.
