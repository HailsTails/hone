# Unit without a running test

```json
{
  "group": "Tests",
  "seen": "A file with a runtime export and no `name.test.ts` beside it that imports and runs it.",
  "mayIndicate": [
    {
      "case": "gives-each-unit-its-test",
      "points": [
        {
          "rule": "tested-where-its-owned"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the missing test",
  "seenBy": [
    "files",
    "graph"
  ],
  "reports": "seen",
  "recipes": [
    "companion-test-file"
  ],
  "correctUses": []
}
```
