# Loop keyword

```json
{
  "group": "Effects and state",
  "seen": "`for`, `for…of`, `for…in`, `for await`, `while` or `do`.",
  "mayIndicate": [
    {
      "case": "makes-a-new-value-from-what-it-has",
      "points": [
        {
          "principle": "no-hidden-effects"
        }
      ]
    },
    {
      "case": "causes-an-effect",
      "points": [
        {
          "rule": "ports-declared-inside"
        }
      ]
    },
    {
      "case": "coordinates-other-units",
      "points": [
        {
          "rule": "doer-or-orchestrator"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "functional-iteration"
  ],
  "correctUses": [
    {
      "situation": "draining a stream",
      "kind": "authorised-location",
      "at": "in its source's adapter"
    }
  ]
}
```
