# Own type guard

```json
{
  "group": "Claimed or loose types",
  "seen": "A function of ours whose return type is `x is T` or `asserts x is T`.",
  "mayIndicate": [
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "declared-not-asserted"
        }
      ]
    },
    {
      "case": "reads-data-from-outside",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
        }
      ]
    }
  ],
  "breachUsuallySits": "at a missing schema parse in the adapter, or in a declaration too wide",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "zod-at-the-producers-adapter",
    "fix-the-declaration-not-the-value"
  ],
  "correctUses": []
}
```
