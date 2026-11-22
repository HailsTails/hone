# Branch in a test

```json
{
  "group": "Tests",
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
  "seenBy": [
    "syntax"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "assert-to-narrow",
    "iteach-over-typed-rows"
  ],
  "correctUses": [],
  "breachACheckCouldName": "the type branched on, by types.",
  "toNameTheBreach": "types: the declaring type of the member read."
}
```
