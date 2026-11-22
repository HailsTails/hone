# Wide port

```json
{
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
  "recipes": [
    "narrow-ports"
  ],
  "correctUses": []
}
```
