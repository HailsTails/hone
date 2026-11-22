# Throw or catch in a test

```json
{
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
  "recipes": [
    "failure-asserted-as-a-value"
  ],
  "correctUses": []
}
```
