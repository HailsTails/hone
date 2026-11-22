# Catch-all failure kind

```json
{
  "group": "Failures",
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
  "seenBy": [
    "types",
    "person"
  ],
  "reports": "seen",
  "recipes": [
    "result-union",
    "failure-mapping-at-the-adapter"
  ],
  "correctUses": []
}
```
