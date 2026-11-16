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

## Tools: the model decides

A tool is a function you hand to the model along with a description of what it does. Your code never calls it directly; Claude reads the description and decides when to use it.

Here's the tool that changes a movie's rating:

```python
@mcp.tool(
    name="update_movie_rating",
    description=(
        "Change the rating of a movie, identified by its exact title "
        "(case-insensitive). Only the rating can be changed. If several "
        "movies share the title, release_year is required. Returns the "
        "updated movie."
    ),
)
async def update_movie_rating(
    title: str = Field(description="The exact title of the movie to update"),
    rating: float = Field(ge=0, le=10, description="The new rating, from 0 to 10 (stored with one decimal)"),
    release_year: int | None = Field(
        default=None,
        description="Release year, only needed when several movies share the title",
    ),
) -> dict:
    ...
```

On the app side, the chat loop doesn't know which tools exist. It asks every connected MCP server for its tools, passes the list to Claude, and runs whatever Claude asks for:

```python
while True:
    response = self.claude_service.chat(
        messages=self.messages,
        tools=await ToolManager.get_all_tools(self.clients),
    )
    self.claude_service.add_assistant_message(self.messages, response)

    if response.stop_reason == "tool_use":
        tool_result_parts = await ToolManager.execute_tool_requests(
            self.clients, response
        )
        self.claude_service.add_user_message(self.messages, tool_result_parts)
    else:
        ...
        break
```

When I type *"Set the rating of The Goonies to 8.5"*, nothing in my code parses that sentence. Claude sees a tool whose description matches, fills in `title` and `rating`, and the loop runs the call. That's what "model-controlled" means in practice.

