# Inner layer imports outer

```json
{
  "group": "Layers and wiring",
  "seen": "A domain or business-logic file that imports an adapter or infrastructure file.",
  "mayIndicate": [
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "rule": "ports-declared-inside"
        },
        {
          "rule": "outside-dependencies-stay-at-boundaries"
        },
        {
          "principle": "external-behaviour-sits-at-a-boundary"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the import, or in a port declared on the wrong side",
  "seenBy": [
    "app"
  ],
  "reports": "seen",
  "recipes": [
    "port-in-the-domain"
  ],
  "correctUses": []
}
```
