# Export from a test

```json
{
  "group": "Tests",
  "seen": "An export declaration, assignment or modifier in a test file, including a type export.",
  "mayIndicate": [
    {
      "case": "states-what-the-unit-gives-back-for-one-case-or-several",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    },
    {
      "case": "gives-each-unit-its-test",
      "points": [
        {
          "rule": "tested-where-its-owned"
        }
      ]
    }
  ],
  "breachUsuallySits": "in a test file that exposes code for another file to use",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [],
  "correctUses": []
}
```
