# Unasserted call

```json
{
  "group": "Tests",
  "seen": "A stub or spy passed to the unit whose calls the test never asserts.",
  "mayIndicate": [
    {
      "case": "uses-what-a-collaborator-gives-back",
      "points": [
        {
          "rule": "written-out-answers"
        }
      ],
      "quote": "If the unit calls something we check it calls it."
    }
  ],
  "breachUsuallySits": "in the test",
  "seenBy": [
    "syntax",
    "types"
  ],
  "reports": "seen",
  "recipes": [
    "stub-with-vifn"
  ],
  "correctUses": []
}
```
