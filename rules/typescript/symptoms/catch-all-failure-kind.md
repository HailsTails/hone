# Catch-all failure kind

```json
{
  "seen": "A failure variant such as `unknown`, `other` or a bare message string, carrying no named cause.",
  "mayIndicate": [
    {
      "case": "an-operation-can-fail",
      "points": [
        {
          "rule": "failures-are-values"
        }
      ]
    },
    {
      "case": "a-value-is-one-of-several-kinds-or-states",
      "points": [
        {
          "rule": "kinds-are-named"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the adapter, which did not name the outside failure",
  "recipes": [
    "result-union",
    "failure-mapping-at-the-adapter"
  ],
  "correctUses": []
}
```
