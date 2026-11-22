# Absence standing for a state

```json
{
  "group": "Claimed or loose types",
  "seen": "A field typed `T | null` or `T | undefined`, or optional, whose absence means a state rather than \"not given\".",
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
      "case": "keeps-state-or-settings-across-calls",
      "points": [
        {
          "principle": "no-hidden-effects"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the type, which needs named kinds",
  "seenBy": [
    "person",
    "types"
  ],
  "recipes": [
    "tagged-union-and-exhaustive-switch"
  ],
  "correctUses": [],
  "howItIsSeen": "types to find candidates."
}
```
