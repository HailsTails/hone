# Library class built in place

```json
{
  "group": "The outside world reached directly",
  "seen": "`new` on a class from an outside dependency, outside that dependency's adapter.",
  "mayIndicate": [
    {
      "case": "takes-an-outside-dependency",
      "points": [
        {
          "rule": "outside-dependencies-stay-at-boundaries"
        }
      ]
    },
    {
      "case": "keeps-state-or-settings-across-calls",
      "points": [
        {
          "principle": "no-hidden-effects"
        }
      ]
    }
  ],
  "breachUsuallySits": "at a missing adapter",
  "seenBy": [
    "types"
  ],
  "reports": "seen",
  "recipes": [
    "adapter-per-outside-party",
    "closure-factory"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "boundary-record",
      "at": "on that dependency's adapter"
    }
  ]
}
```
