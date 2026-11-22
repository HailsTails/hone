# No lock file

```json
{
  "group": "Dependencies and versions",
  "seen": "A repository with dependencies and no committed lock file.",
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
  "breachUsuallySits": "in the repository",
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
