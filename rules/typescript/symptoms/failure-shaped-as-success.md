# Failure shaped as success

```json
{
  "seen": "A failed path that returns `null`, `false`, `[]`, `undefined` or a default, or a `catch` that returns one.",
  "mayIndicate": [
    {
      "case": "an-operation-can-fail",
      "points": [
        {
          "rule": "failures-are-values"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit's return type",
  "recipes": [
    "result-union"
  ],
  "correctUses": []
}
```
