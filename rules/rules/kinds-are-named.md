# Kinds are named

```json
{
  "principle": "the-type-checker-proves-it",
  "standing": "accepted",
  "lenses": [
    "type-soundness"
  ]
}
```

- **What must hold:** A value of several kinds or states is a closed set of named kinds of our own, and wherever code chooses by kind, the checker proves every kind is chosen.
- **Source:** Minsky's named variants.

"Of ours" matters in Declared, not asserted: a test framework's assertion that narrows a value is not a claim of ours. The strictest checker setting is a case; the principle gives it.
