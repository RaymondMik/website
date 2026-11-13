---
title: "Four strategies to keep your context window in budget"
description: "Pruning, compaction, clearing and subagent handoffs: four ways to keep a multi-turn agent session within its context window, with Python examples."
pubDate: 2026-11-13
tags: ["llm", "agents", "context-engineering", "llm-engineering"]
---

The context window is not a free resource: there is a limit to how much an LLM can hold in working memory. Everything the model takes in, including your system prompt, the conversation so far and every tool result, counts against that limit. Managing the context window in an agent workflow is therefore crucial, and it's what context engineering is fundamentally about.

In a single prompt you never notice the limit. In an agent session with twenty tool calls, every result stays in the window until the end, and real tool outputs are often several times larger than your test fixtures. Below are four strategies for staying within budget, each with a short Python example using the Anthropic SDK. Each one trades away a different kind of continuity.

## 1. Pruning: rewind to a checkpoint

Pruning drops everything after a chosen point in the conversation. Use it when the agent has gone down a dead end, or piled up debugging back-and-forth that won't help the next task.

```python
def checkpoint(session, name):
    session.checkpoints[name] = len(session.messages)

def rewind(session, name, carry_over=None):
    session.messages = session.messages[:session.checkpoints[name]]
    if carry_over:  # keep one lesson from the abandoned attempt
        session.messages += [
            {"role": "user", "content": f"Note from an abandoned attempt: {carry_over}"},
            {"role": "assistant", "content": "Understood."},
        ]

checkpoint(s, "before_experiment")
s.send("Try rewriting the client with asyncio.")
rewind(s, "before_experiment",
       carry_over="An asyncio rewrite breaks sync callers; stay synchronous.")
```

The cost is that anything learned after the checkpoint is gone. The optional `carry_over` keeps the one useful lesson without the noise that produced it.

## 2. Compaction: summarize the past, keep the present

Compaction replaces older turns with a summary and keeps the most recent turns word for word. Use it when the session is nearing the limit but the agent still needs what it has learned.

The summarizer prompt decides what the agent remembers afterwards. "Summarize the conversation so far" loses exactly the details the next step depends on. Name what must survive:

```python
SUMMARIZER_PROMPT = """Summarize this agent session, preserving exactly:
- every file path created, modified or deleted
- every decision made, with its reason
- every error and how it was resolved
- open tasks and the current next step"""

def maybe_compact(session, budget=150_000, threshold=0.7):
    used = client.messages.count_tokens(
        model=MODEL, system=session.system, messages=session.messages
    ).input_tokens
    if used > budget * threshold:
        compact(session, keep_recent_turns=4)
```

`compact()` sends the older turns to Claude with that prompt, then rebuilds the history as one summary message plus the recent turns. Two details matter. The history must still alternate user and assistant turns, and the cut must never separate a `tool_use` from its `tool_result`, or the API rejects the request.

The `count_tokens` call measures the real size before the request goes out, so compaction runs only when it's needed. If you'd rather not write this yourself, the API also offers server-side compaction as a beta feature.

## 3. Clearing: start fresh, on purpose

Clearing starts a new session with an empty context. Use it when the next task has nothing to do with the last one, and old context would only bias or confuse the agent.

Nothing carries over, so whatever must survive has to be written somewhere persistent first, the way Claude Code uses a CLAUDE.md file:

```python
NOTES_FILE = Path("PROJECT_NOTES.md")

def save_note(text):
    with NOTES_FILE.open("a") as f:
        f.write(f"- {text}\n")

def clear(base_system):
    notes = NOTES_FILE.read_text() if NOTES_FILE.exists() else ""
    system = base_system + (f"\n\n<project_notes>\n{notes}</project_notes>" if notes else "")
    return Session(system=system)

save_note("api_client.py has a synchronous @retry decorator (3 attempts).")
s = clear(base_system)
```

The notes file becomes the only memory between sessions. Keep it short and factual, because it is loaded into every new session's system prompt.

## 4. Subagent handoffs: delegate the journey, keep the answer

A subagent works in its own context window. It gets a scoped task, the minimum context it needs, its own tools and a clear exit condition. It does the messy work, and only a short summary comes back. Use it for exploration, where the search is long but the answer is short.

```python
def run_subagent(task, context, tools, tool_impls, max_steps=15):
    system = ("You are a subagent on one scoped task. When done, reply with "
              "'RESULT:' and a concise summary with exact paths and values.")
    messages = [{"role": "user",
                 "content": f"<task>{task}</task>\n<context>{context}</context>"}]
    for _ in range(max_steps):
        resp = client.messages.create(model=SUBAGENT_MODEL, max_tokens=2048,
                                      system=system, tools=tools, messages=messages)
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")
        messages.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": b.id,
             "content": str(tool_impls[b.name](**b.input))[:20_000]}
            for b in resp.content if b.type == "tool_use"]})
    return "Step limit reached without a result."

finding = run_subagent("List every call site of ApiClient.request.",
                       "Python project; client is in api_client.py.",
                       SUBAGENT_TOOLS, SUBAGENT_IMPLS)
s.send(f"Call sites found:\n{finding}\nNow write the retry decorator.")
```

Every file the subagent opened is thrown away with its context. The main session pays only for `finding`. What you lose is visibility into how the subagent reached its answer.

## Choosing between them

| Strategy | Reach for it when | What you give up |
| --- | --- | --- |
| Pruning | The agent took a wrong turn | Whatever it learned after the checkpoint |
| Compaction | You're near the limit on the same task | Details the summary leaves out |
| Clearing | The next task is unrelated | Everything not saved to notes |
| Subagents | A subtask is self-contained | How the answer was reached |

Two API features make all four cheaper. Prompt caching (a `cache_control` breakpoint on your system prompt and tool definitions) lets later turns reuse that stable prefix at a fraction of the cost. Token counting tells you how close you are to the limit before a request fails, not after.

All of this adds code, so measure your real token usage first. If your sessions never come near the limit, you don't need it. If they do, design for it from the start rather than patching it after a production failure.
