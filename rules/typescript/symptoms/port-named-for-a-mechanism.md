# Port named for a mechanism

```json
{
  "group": "Layers and wiring",
  "seen": "A port named for a technology (`HttpClient`, `Fs`, `Sqlite`) rather than a capability.",
  "mayIndicate": [
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "rule": "ports-declared-inside"
        }
      ]
    },
    {
      "case": "names-something",
      "points": [
        {
          "rule": "one-word-everywhere"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the port",
  "seenBy": [
    "person"
  ],
  "recipes": [
    "port-in-the-domain"
  ],
  "correctUses": []
}
```
