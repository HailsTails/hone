# Functional iteration

```json
{
  "serves": {
    "rule": "doer-or-orchestrator"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"For of mutates by its nature. It doesn't return. It's state holding required or side effect based.\"",
    "standing": "accepted"
  }
}
```

- **Method:** Work over several values uses `map`, `filter`, `flatMap` or `reduce`, returning new values. No `for`, `for…of` or `while`. A stream is drained with `for await` only in its source's adapter, at an authorised location.
- **You can tell because:** No loop keyword outside a recorded drain. Nothing is pushed into an outer binding.
- **Industry name:** Collection Pipeline; Replace Loop with Pipeline (Fowler).
