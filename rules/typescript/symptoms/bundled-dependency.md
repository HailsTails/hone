# Bundled dependency

```json
{
  "group": "Dependencies and versions",
  "seen": "Published build output that holds a dependency's code that the package manifest does not declare.",
  "mayIndicate": [
    {
      "case": "ships-code-for-others",
      "points": [
        {
          "rule": "shipped-risk-declared"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the build config",
  "seenBy": [
    "files"
  ],
  "reports": "seen",
  "recipes": [
    "declared-not-bundled"
  ],
  "correctUses": [],
  "howItIsSeen": "files (build output)."
}
```
