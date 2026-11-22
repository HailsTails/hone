# Types-only file

```json
{
  "group": "Names, prose and files",
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
      ],
      "quote": "There shouldn't be type only files. They should be entities."
    }
  ],
  "breachUsuallySits": "in the entity's module",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "entity-module"
  ],
  "correctUses": []
}
```
