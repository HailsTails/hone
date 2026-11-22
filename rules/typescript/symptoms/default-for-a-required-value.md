# Default for a required value

```json
{
  "seen": "`??`, `||` or a parameter default that supplies a required config, context or environment value.",
  "mayIndicate": [
    {
      "case": "reads-data-from-outside",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
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
  "breachUsuallySits": "in the declaration or the adapter: a missing value is a failure",
  "recipes": [
    "zod-at-the-producers-adapter",
    "bounded-context-generic"
  ],
  "correctUses": []
}
```
