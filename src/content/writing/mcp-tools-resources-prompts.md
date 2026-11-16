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

A few things I learned writing tools:

- **The description is the interface.** Claude never sees your SQL, only the name, the description and the parameter schema. A description written for a person ("updates a movie") gives you worse calls than one written for the model ("identified by its exact title… If several movies share the title, release_year is required").
- **Put limits in the schema.** `Field(ge=0, le=10)` becomes `minimum` and `maximum` in the JSON schema Claude receives, and the server rejects bad values before any of my code runs.
- **Make writes strict and errors helpful.** The read tool, `get_movie_by_title`, accepts partial titles. The write tool needs an exact title so a near-match can't overwrite the wrong movie. When it fails, the error tells the model what to do next: *"Use get_movie_by_title to find the exact title"* or *"Pass release_year to choose one."* Claude reads tool errors, so they work as instructions.

## Resources: the app decides

A resource is data the server exposes at a URI. Unlike a tool, it isn't offered to the model. Your application decides when to read it and what to do with the result.

The server exposes two:

```python
@mcp.resource("movies://titles", mime_type="application/json")
async def list_movie_titles() -> list[str]:
    ...

@mcp.resource("movies://titles/{title}", mime_type="text/plain")
async def get_movie(title: str) -> str:
    movies = await _movies_with_title(unquote(title))
    return "\n\n".join(_format_movie(m) for m in movies)
```

The app uses them for the two jobs resources are best at.

**1. Filling the UI.** When the CLI starts, it reads `movies://titles` once and feeds the list into the autocomplete. Typing `@Back to` and pressing Tab offers *Back to the Future* and *Back to the Future Part II*. Claude is never involved.

**2. Adding context to the conversation.** When a message mentions a movie with `@`, the app fetches that movie's details and adds them to the prompt before Claude sees it:

```python
async def _extract_resources(self, query: str) -> str:
    remaining = query.lower()
    mentioned = []

    titles = await self.list_movie_titles()
    for title in sorted(titles, key=len, reverse=True):
        needle = f"@{title.lower()}"
        if needle in remaining:
            remaining = remaining.replace(needle, " ")
            mentioned.append((title, await self.get_movie(title)))
    ...
```

The difference from a tool is the important part. If I ask *"Compare @Die Hard with @Lethal Weapon"*, Claude doesn't spend a round trip deciding to look them up; the details are already in the message. The app knows the user wants these movies, so it doesn't wait for the model to work that out.

This part had two gotchas that are worth sharing:

- **Titles aren't clean URI segments.** "When Harry Met Sally..." and "Mad Max 2: The Road Warrior" contain spaces, colons and punctuation. FastMCP matches resource templates against the raw URI without decoding it, so the client encodes each title with `quote(title, safe="")` and the server decodes it with `unquote`.
- **Match the longest titles first.** Mentions are searched as `@<title>` rather than by splitting on spaces, because titles span several words. Checking longer titles first means `@Back to the Future Part II` isn't also read as `@Back to the Future`.

## Prompts: the user decides

A prompt is a ready-made workflow that the server defines and the user starts on purpose, with a button, a menu item or, here, a slash command.

```python
@mcp.prompt(
    name="summarize_description",
    description="Summarize a movie's description in 50 words or fewer",
)
async def summarize_description(
    title: str = Field(description="The exact title of the movie to summarize"),
) -> list[base.Message]:
    movies = await _movies_with_title(title)
    details = "\n\n".join(_format_movie(m) for m in movies)

    prompt = f"""
    Summarize the description of the movie below in 50 words or fewer.
    ...
    The stored description must not be changed, so don't call any tools.
    """
    return [base.UserMessage(prompt)]
```

The user types `/summarize_description Ferris Bueller's Day Off` (both the command and the title autocomplete). The app asks the server to render the prompt, converts the returned messages into the Anthropic message format, and sends them to Claude. The user chose to run this exact workflow, and the server author chose its wording, so you get the same carefully written instructions every time instead of whatever the user improvises.

Two design choices:

- **The prompt fetches its own data.** It doesn't tell Claude to call `get_movie_by_title`; it puts the movie's details straight into the message. That's one less round trip and one less thing to go wrong.
- **It's read-only on purpose.** The summary is shown, not saved. Ratings are the only thing users can edit in this app, and I wanted the prompt to follow the same rule, so it says outright that no tools should be called.

## Choosing the right primitive

| | Tool | Resource | Prompt |
| --- | --- | --- | --- |
| **Who triggers it** | The model | Your app | The user |
| **What it's for** | Giving Claude new abilities | Getting data into the UI or the context | Ready-made workflows run on demand |
| **In this project** | `get_movie_by_title`, `update_movie_rating` | Autocomplete and `@` mentions | `/summarize_description` |

When I add a feature now, I ask three questions:

1. **Should Claude be able to do this on its own, mid-conversation?** Make it a tool.
2. **Does my app need this data for the screen, or for context it can attach itself?** Make it a resource.
3. **Is this a workflow a user will want to start on purpose, with the same instructions every time?** Make it a prompt.

The same capability can show up more than once. Looking up a movie is a tool (Claude searches when it needs to), a resource (the app attaches it when you `@` mention it) and part of a prompt (the summary workflow embeds it). Same data, three different people deciding when to fetch it.

## Wrapping up

Tools serve the model, resources serve your app, and prompts serve your users. Once I started asking "who decides when this runs?" instead of "how do I expose this data?", the design choices mostly made themselves, and the app became more predictable: Claude handles what needs judgment, the app handles what it already knows, and users get shortcuts for what they do often.

If you're starting with MCP, build something small with all three. A database you know well, one tool, one resource and one prompt will teach you more than any diagram, including the ones in this post.
