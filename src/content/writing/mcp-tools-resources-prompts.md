---
title: "Tools, Resources and Prompts: Who Pulls the Trigger in MCP?"
date: 2026-10-10
description: "A hands-on look at the three MCP server primitives, using a small terminal chat app over a PostgreSQL database of 1980s movies."
tags: [mcp, llm, claude, python, postgresql]
draft: true
---

This article walks through the three MCP server primitives (tools, resources and prompts) using a small terminal chat app that talks to a PostgreSQL database of 1980s movies. The MCP server is written in Python with FastMCP and exposes the database to Claude, which decides when to call its tools, while the app handles resources and the user triggers prompts with slash commands.

What sets the three apart is who is in control:

- **Tools** are controlled by the model.
- **Resources** are controlled by the application.
- **Prompts** are controlled by the user.


Each primitive takes a different path through the app:

```
  Claude ──(decides to call)──────────▶ Tool       get_movie_by_title, update_movie_rating
  App    ──(fetches when it needs)────▶ Resource   movies://titles, movies://titles/{title}
  User   ──(types a /command)─────────▶ Prompt     summarize_description
```

