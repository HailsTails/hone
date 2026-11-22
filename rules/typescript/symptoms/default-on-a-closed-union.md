# Default on a closed union

```json
{
  "group": "Claimed or loose types",
  "seen": "`default:` in a `switch` over a closed union.",
  "mayIndicate": [
    {
      "case": "a-value-is-one-of-several-kinds-or-states",
      "points": [
        {
          "rule": "kinds-are-named"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the switch",
  "seenBy": [
    "types"
  ],
  "reports": "seen",
  "recipes": [
    "tagged-union-and-exhaustive-switch"
  ],
  "correctUses": [
    {
      "situation": "a switch is over an open set of values and needs a fallback",
      "kind": "authorised-location"
    }
  ]
}
```
