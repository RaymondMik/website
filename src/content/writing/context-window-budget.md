---
title: "Four strategies to keep your context window in budget"
description: "Pruning, compaction, clearing and subagent handoffs: four ways to keep a multi-turn agent session within its context window, with Python examples."
pubDate: 2026-11-13
tags: ["llm", "agents", "context-engineering", "claude"]
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
