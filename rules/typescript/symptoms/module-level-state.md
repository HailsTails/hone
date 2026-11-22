# Module-level state

```json
{
  "seen": "A module-scope `let`, or a module-scope collection that functions change.",
  "mayIndicate": [
    {
      "case": "keeps-state-or-settings-across-calls",
      "points": [
        {
          "principle": "no-hidden-effects"
        },
        {
          "principle": "external-behaviour-sits-at-a-boundary"
        }
      ]
    }
  ],
  "breachUsuallySits": "at a missing adapter for the state",
  "recipes": [
    "closure-factory"
  ],
  "correctUses": []
}
```
