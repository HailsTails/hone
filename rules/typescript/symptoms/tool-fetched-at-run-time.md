# Tool fetched at run time

```json
{
  "group": "Dependencies and versions",
  "seen": "`npx`, `dlx`, `bunx` or a download-and-run in a script, CI step or doc.",
  "mayIndicate": [
    {
      "case": "takes-an-outside-dependency",
      "points": [
        {
          "rule": "tools-live-in-the-repo"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the script",
  "seenBy": [
    "files"
  ],
  "reports": "seen",
  "recipes": [
    "repo-scripts-only"
  ],
  "correctUses": []
}
```
