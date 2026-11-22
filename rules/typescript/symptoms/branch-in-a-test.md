# Branch in a test

```json
{
  "seen": "`if`, a ternary, `&&`, `||`, `??`, `?.` or `switch` in a test file.",
  "mayIndicate": [
    {
      "case": "checks-a-value-that-may-be-one-of-several-outcomes",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    },
    {
      "case": "a-value-is-one-of-several-kinds-or-states",
      "situation": "the unit's output",
      "points": [
        {
          "rule": "kinds-are-named"
        }
      ]
    },
    {
      "case": "an-operation-can-fail",
      "situation": "the unit's output",
      "points": [
        {
          "rule": "failures-are-values"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit's output type, where optional or loose shapes force the test to branch",
  "recipes": [
    "assert-to-narrow",
    "iteach-over-typed-rows"
  ],
  "correctUses": []
}
```
