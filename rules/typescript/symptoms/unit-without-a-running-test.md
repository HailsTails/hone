# Unit without a running test

```json
{
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
  "recipes": [
    "companion-test-file"
  ],
  "correctUses": []
}
```
