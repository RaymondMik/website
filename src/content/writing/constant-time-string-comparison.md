---
title: "Constant-Time String Comparison with ^ and |="
description: "Why comparing secrets with === leaks timing information, and how two bitwise operators — XOR and OR-assign — remove the signal entirely."
pubDate: 2026-08-14
tags: [security, javascript]
---

If you've ever worked on security-sensitive code, you've probably heard that comparing secrets with `===` is dangerous. But why? And what's the alternative? Let's break it down.

## The problem with string comparison (`===`)

When JavaScript compares two strings with `===`, it stops as soon as it finds the first differing character:

```js
"abc" === "axc"  // stops at position 1, fast
"abc" === "abd"  // stops at position 2, slightly slower
"abc" === "abc"  // checks all 3, slowest
```

This seems harmless, but it leaks timing information. An attacker who can measure how long your comparison takes can infer how many characters matched. The longer it takes, the more of the secret they got right. Instead of brute-forcing the entire secret at once, they can crack it one character at a time. Given enough samples, this statistical signal can be used to recover the secret one character at a time, without ever needing direct access to it. This is a timing attack. It's particularly relevant for secrets compared in hot paths like HTTP middleware, where the attacker controls the input and can automate the measurement. Constant-time comparison removes the signal: the loop always runs to completion regardless of where the first mismatch occurs, so the response time reveals nothing about how many characters were correct.

## The building blocks

### `^` — XOR

XOR compares two numbers bit by bit and answers: are these two bits different?

```text
0 ^ 0 = 0  (same)
1 ^ 1 = 0  (same)
0 ^ 1 = 1  (different)
1 ^ 0 = 1  (different)
```

Applied to two bytes:

```text
'h' → 01101000
'i' → 01101001
XOR → 00000001  ← non-zero, bytes differ

'h' → 01101000
'h' → 01101000
XOR → 00000000  ← zero, bytes are identical
```

The key property: `a ^ b` is `0` if and only if `a` and `b` are identical.

### `|=` — OR-assign

`|=` accumulates values using bitwise OR:

```js
diff |= value
// same as:
diff = diff | value
```

The key property of `|`: once a bit is set to 1, it can never go back to 0.

```text
diff |= 0   → diff = 0
diff |= 26  → diff = 26   (mismatch recorded)
diff |= 0   → diff = 26   (still 26, mismatch preserved)
```

## Putting them together

Here's a constant-time string comparison using only these two operators:

```ts
const constantTimeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
};
```

Walk through what happens on each iteration:

- `aBytes[i] ^ bBytes[i]` produces `0` if the bytes match, non-zero if they differ
- `diff |= ...` accumulates that result — any mismatch permanently marks `diff` as non-zero
- The loop has no `return`, no `break` — it always runs every iteration regardless of mismatches
- Only after the full loop do we check `diff === 0`

Example with `"abc"` vs `"axc"`:

```text
i=0: 'a' ^ 'a' = 0   → diff = 0
i=1: 'b' ^ 'x' = 26  → diff = 26
i=2: 'c' ^ 'c' = 0   → diff = 26  ← mismatch at i=1 preserved

return 26 === 0 → false ✓
```

The mismatch at position 1 is never forgotten, and the loop never exits early.

## Why not just `diff = aBytes[i] ^ bBytes[i]`?

Using `=` instead of `|=` would overwrite `diff` on every iteration, keeping only the result of the last byte comparison:

```text
i=0: diff = 0   (match)
i=1: diff = 26  (mismatch)
i=2: diff = 0   (match — overwrites the mismatch!)

return 0 === 0 → true ✗  WRONG
```

The `|=` is essential — it ensures no mismatch can ever be overwritten by a subsequent match.

## A note on environments

Node.js provides `crypto.timingSafeEqual` for this purpose. But if you're running in a restricted environment like the Next.js Edge Runtime — which only supports Web Standard APIs and not Node.js built-ins — you need to implement it yourself. The function above uses only `TextEncoder` and bitwise operators, both of which are available everywhere including the Edge Runtime.

## Alternative approaches

If you're writing code that runs only in a Node.js environment, the standard library already has you covered: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` from Node's built-in `crypto` module does exactly this, and it's the idiomatic solution for server-side Node.js code. There are also small npm packages like [tsscmp](https://www.npmjs.com/package/tsscmp) and [safe-compare](https://www.npmjs.com/package/safe-compare) that wrap the same idea with a friendlier API. The Web Crypto API (`globalThis.crypto.subtle`) is another option — it's available in both browsers and Edge runtimes — but it doesn't expose a direct constant-time comparison function; its cryptographic primitives (like `deriveKey` or `sign`) are internally timing-safe, but you'd have to derive a MAC and compare digests, which is significantly more complex for a simple shared-secret check. In our case, the code runs in Next.js middleware, which executes in the Edge Runtime — a lightweight V8 environment that deliberately excludes Node.js built-ins. That ruled out `crypto.timingSafeEqual` and any library that depends on it. The manual XOR loop using `TextEncoder` is the leanest solution that works across all JavaScript runtimes without any dependencies.

---

Timing attacks are subtle, but the fix is elegant: two bitwise operators, no conditionals, always runs to completion. `^` detects differences, `|=` makes sure they're never forgotten.
