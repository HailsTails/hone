# Assertion outside a test body

```json
{
  "group": "Tests",
  "seen": "An assertion outside a function passed to an it or test call.",
  "mayIndicate": [
    {
      "case": "states-what-the-unit-gives-back-for-one-case-or-several",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    }
  ],
  "breachUsuallySits": "in a suite body, hook, or helper that asserts outside the test case",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [],
  "correctUses": []
}
```
