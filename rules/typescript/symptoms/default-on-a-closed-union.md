# Default on a closed union

```json
{
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
  "recipes": [
    "tagged-union-and-exhaustive-switch"
  ],
  "correctUses": []
}
```
