# Floating version

```json
{
  "group": "Dependencies and versions",
  "seen": "A range (`^`, `~`, `*`, `x`) or a tag (`latest`, `lts`) for an outside dependency, a runtime or a CI action.",
  "mayIndicate": [
    {
      "case": "takes-an-outside-dependency",
      "points": [
        {
          "rule": "fixed-versions"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the manifest or workflow",
  "seenBy": [
    "files"
  ],
  "reports": "seen",
  "recipes": [
    "exact-pins-and-a-lock-file"
  ],
  "correctUses": []
}
```
