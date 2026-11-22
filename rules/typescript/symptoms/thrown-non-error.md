# Thrown non-error

```json
{
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
  "recipes": [
    "failure-mapping-at-the-adapter"
  ],
  "correctUses": []
}
```
