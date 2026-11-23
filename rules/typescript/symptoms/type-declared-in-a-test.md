# Type declared in a test

```json
{
  "group": "Tests",
  "seen": "A type alias, interface or enum declared in a test file.",
  "mayIndicate": [
    {
      "case": "puts-code-in-a-file-or-folder",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    },
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "declared-not-asserted"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit whose contract the test repeats or cannot import",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [],
  "correctUses": []
}
```
