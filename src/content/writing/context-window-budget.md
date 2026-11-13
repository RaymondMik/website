---
title: "Four strategies to keep your context window in budget"
description: "Pruning, compaction, clearing and subagent handoffs: four ways to keep a multi-turn agent session within its context window, with Python examples."
pubDate: 2026-11-13
tags: ["llm", "agents", "context-engineering", "claude"]
---

The context window is not a free resource: there is a limit to how much an LLM can hold in working memory. Everything the model takes in, including your system prompt, the conversation so far and every tool result, counts against that limit. Managing the context window in an agent workflow is therefore crucial, and it's what context engineering is fundamentally about.
