# Throw or catch in a test

```json
{
  "group": "Tests",
  "seen": "`throw`, `try` or `catch` in a test file.",
  "mayIndicate": [
    {
      "case": "states-what-the-unit-gives-back-for-one-case-or-several",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    },
    {
      "case": "an-operation-can-fail",
      "points": [
        {
          "rule": "failures-are-values"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit, which throws",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "failure-asserted-as-a-value"
  ],
  "correctUses": []
}
```
