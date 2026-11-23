# Code or prose read as text

```json
{
  "group": "Tests",
  "seen": "A test reads TypeScript or Markdown source through a file read, a raw import, or a raw glob.",
  "mayIndicate": [
    {
      "case": "states-what-the-unit-gives-back-for-one-case-or-several",
      "points": [
        {
          "principle": "tests-are-ours"
        }
      ]
    }
  ],
  "breachUsuallySits": "in a test that checks the words in a file instead of the code behavior",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [],
  "correctUses": [
    {
      "situation": "parsing source to verify its syntax or toolchain compatibility",
      "kind": "authorised-location",
      "at": "at the test that owns that proof"
    }
  ]
}
```
