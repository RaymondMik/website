---
title: "The Secure Flag in Cookies: What It Is and Why It Matters"
description: "One cookie attribute, enforced entirely by the browser, that shuts down a whole class of network-level attacks — and what it deliberately doesn't protect against."
pubDate: 2025-02-10
tags: [security, web]
---

Cookies are one of the most common ways web applications store state on the user's browser — from session tokens to preferences to tracking data. But by default, cookies have a significant weakness: a browser will send them over any connection, including unencrypted HTTP. The `Secure` flag exists to close that gap.

## How it works

When a cookie is set with the `Secure` attribute, the browser will only include it in requests sent over HTTPS. If the user visits the same site over plain HTTP — whether intentionally or because they were redirected there — the cookie is silently withheld. It doesn't get deleted, it just isn't transmitted.

```text
Set-Cookie: session=abc123; Secure; Path=/
```

That's the entire mechanism. One attribute, enforced entirely by the browser.

## Why it matters

Without `Secure`, a cookie can be intercepted by anyone with access to the network traffic between the user and the server. On public Wi-Fi — a café, an airport, a hotel — this is trivially easy with basic tooling. An attacker can read the cookie value, inject it into their own requests, and impersonate the user. This attack is called session hijacking.

For session tokens, authentication cookies, or anything that identifies a user, this is critical. Stealing a session cookie gives an attacker full access to the account without ever knowing the password.

## What it doesn't do

`Secure` only protects the cookie in transit. It says nothing about:

- What's stored in the cookie (encrypt sensitive values separately)
- Whether JavaScript can read it (that's `HttpOnly`)
- Whether it can be sent cross-site (that's `SameSite`)

These three attributes work together. A well-hardened session cookie typically carries all three: `Secure; HttpOnly; SameSite=Lax`.

## The localhost caveat

`Secure` cookies won't be set over plain HTTP — which breaks local development, since most dev servers run on `http://localhost`. The standard workaround is to conditionally apply the flag based on the environment, enabling it everywhere except local. Modern frameworks and cloud platforms handle this transparently in production since HTTPS is the default, but it's something every developer setting cookies manually needs to be aware of.

## In short

The `Secure` flag is a one-word defence against a class of network-level attacks that are still very much real. It costs nothing to add and should be considered mandatory for any cookie that carries sensitive or identifying information.
