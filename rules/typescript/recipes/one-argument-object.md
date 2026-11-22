# One argument object

```json
{
  "serves": {
    "rule": "handed-what-it-uses"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"Shows up in tests where to avoid writing a large object for 2 fields that impact th test they double cast. It shows the minimum interface principle.\"; \"Functions with no outside influence should take 1. 2 is debatable. But for agents the goal is always 1.\"; \"nope, you will not use tupple like arrays for data\".",
    "standing": "accepted"
  }
}
```

- **Method:** A function whose signature is ours to choose takes one argument: an object with named fields, whose declared type lists only the fields the unit reads. A function whose shape an outside API fixes (a callback to `map` or `reduce`) takes what that API passes. No tuple carries data.
- **You can tell because:** No function of ours has two or more parameters unless an outside API fixes its shape. No test casts to build an input.
- **Industry name:** Introduce Parameter Object (Fowler), always one object.
- **Review:** the single argument is an object with named fields, not a positional scalar
