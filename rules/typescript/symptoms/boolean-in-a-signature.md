# Boolean in a signature

```json
{
  "group": "Claimed or loose types",
  "seen": "A `boolean` parameter, field, or return that stands for a mode or state.",
  "mayIndicate": [
    {
      "case": "a-value-is-one-of-several-kinds-or-states",
      "points": [
        {
          "rule": "kinds-are-named"
        }
      ]
    },
    {
      "case": "does-one-job",
      "points": [
        {
          "rule": "doer-or-orchestrator"
        }
      ],
      "quote": "boolean inputs are a smell, disallowed"
    }
  ],
  "breachUsuallySits": "at a missing named kind, or in a unit with two modes",
  "seenBy": [
    "syntax",
    "types"
  ],
  "reports": "seen",
  "recipes": [
    "tagged-union-and-exhaustive-switch"
  ],
  "correctUses": [],
  "howItIsSeen": "types to tell a predicate."
}
```
