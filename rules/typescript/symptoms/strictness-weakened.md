# Strictness weakened

```json
{
  "seen": "A project whose resolved compiler options leave a strict flag off.",
  "mayIndicate": [
    {
      "case": "sets-how-strictly-the-checker-works",
      "points": [
        {
          "principle": "the-type-checker-proves-it"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the base config or the project that overrides it",
  "recipes": [
    "shared-strict-base-config"
  ],
  "correctUses": []
}
```
