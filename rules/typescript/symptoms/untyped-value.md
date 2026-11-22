# Untyped value

```json
{
  "group": "Claimed or loose types",
  "seen": "`any` in a type position, or a `let` with no type and no initial value.",
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
  "breachUsuallySits": "at the boundary that let an unknown shape in",
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
