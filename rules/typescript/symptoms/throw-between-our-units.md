# Throw between our units

```json
{
  "group": "Failures",
  "seen": "`throw` outside an adapter whose caller's contract is exceptions.",
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
      "case": "sends-data-out-of-the-program",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit, or at a missing mapping in the adapter",
  "seenBy": [
    "syntax",
    "graph"
  ],
  "reports": "seen",
  "recipes": [
    "result-union",
    "failure-mapping-at-the-adapter"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "authorised-location",
      "at": "at an adapter whose caller's contract is exceptions"
    }
  ],
  "howItIsSeen": "graph for adapters."
}
```

"Throwing in specific places allowed is just authorised locations as prose."
