# Port beside its adapter

```json
{
  "group": "Layers and wiring",
  "seen": "A port interface declared in an adapter's module, or beside its default adapter.",
  "mayIndicate": [
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "rule": "ports-declared-inside"
        }
      ],
      "quote": "the port is domain and to be kept separate to the concrete implementation or use"
    }
  ],
  "breachUsuallySits": "in the port's file",
  "seenBy": [
    "graph"
  ],
  "reports": "seen",
  "recipes": [
    "port-in-a-module-of-its-own"
  ],
  "correctUses": []
}
```
