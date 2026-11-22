# Wide port

```json
{
  "group": "Unit shape",
  "seen": "A port with methods its consumer never calls.",
  "mayIndicate": [
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "rule": "handed-what-it-uses"
        },
        {
          "rule": "ports-declared-inside"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the port",
  "seenBy": [
    "graph",
    "types"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "narrow-ports"
  ],
  "correctUses": []
}
```

- **The breach a check could name:** the port.
