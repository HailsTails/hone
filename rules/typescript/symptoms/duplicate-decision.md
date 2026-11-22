# Duplicate decision

```json
{
  "group": "Names, prose and files",
  "seen": "The same decision written in two or more places.",
  "mayIndicate": [
    {
      "case": "reuses-behaviour-from-another-unit-or-type",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    },
    {
      "case": "puts-code-in-a-file-or-folder",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    }
  ],
  "breachUsuallySits": "where the decision's home should be; a clone only surfaces a candidate",
  "seenBy": [
    "person"
  ],
  "recipes": [
    "entity-module",
    "screaming-folders"
  ],
  "correctUses": []
}
```

- **How it is seen:** clone tools surface candidates.
