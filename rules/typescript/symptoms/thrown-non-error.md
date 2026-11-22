# Thrown non-error

```json
{
  "group": "Failures",
  "seen": "`throw` of a literal, an object or a template.",
  "mayIndicate": [
    {
      "case": "sends-data-out-of-the-program",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
        }
      ]
    }
  ],
  "breachUsuallySits": "at the throw site",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "failure-mapping-at-the-adapter"
  ],
  "correctUses": []
}
```
