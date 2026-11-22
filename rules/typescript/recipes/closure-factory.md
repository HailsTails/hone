# Closure factory

```json
{
  "serves": {
    "principle": "no-hidden-effects"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"this is a bunch of nullable and state management mess\". Proposed: Once a method travels as a value, its `this` is a fact the checker does not prove.",
    "standing": "accepted"
  }
}
```

- **Method:** Settings and changing state live in a factory, `createX({ settings })`. It returns an object of functions that close over private bindings. We author no `class`. A library's class is built only in its adapter.
- **You can tell because:** No `class` keyword in our code. No unit reads `this`.
- **Industry name:** Private Members (Crockford).

[Functional iteration](functional-iteration.md) also serves this principle.
