# Types-only file

```json
{
  "seen": "A file that declares only types and is not a port declaration.",
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
      "case": "reuses-behaviour-from-another-unit-or-type",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the entity's module",
  "recipes": [
    "entity-module"
  ],
  "correctUses": []
}
```
