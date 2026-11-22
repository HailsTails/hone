# No lock file

```json
{
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
  "recipes": [
    "exact-pins-and-a-lock-file"
  ],
  "correctUses": []
}
```
