# Default for a required value

```json
{
  "group": "Claimed or loose types",
  "seen": "`??`, `||` or a parameter default that supplies a required config, context or environment value.",
  "mayIndicate": [
    {
      "case": "reads-data-from-outside",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
        }
      ],
      "quote": "no default, must be provided as env var"
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
  "seenBy": [
    "types"
  ],
  "reports": "seen",
  "recipes": [
    "zod-at-the-producers-adapter",
    "bounded-context-generic"
  ],
  "correctUses": []
}
```
