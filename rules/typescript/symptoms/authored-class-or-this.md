# Authored class or this

```json
{
  "group": "Effects and state",
  "seen": "The `class` keyword in our code, `static`-only classes included, or `this` read outside a class.",
  "mayIndicate": [
    {
      "case": "keeps-state-or-settings-across-calls",
      "points": [
        {
          "principle": "no-hidden-effects"
        }
      ]
    },
    {
      "case": "reuses-behaviour-from-another-unit-or-type",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    },
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "declared-not-asserted"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "closure-factory"
  ],
  "correctUses": []
}
```
