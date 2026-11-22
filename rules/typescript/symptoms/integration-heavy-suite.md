# Integration-heavy suite

```json
{
  "group": "Tests",
  "seen": "More integration tests, or more integration test cases, than the bindings to the outside they cover.",
  "mayIndicate": [
    {
      "case": "tests-across-units-or-against-a-real-system",
      "points": [
        {
          "rule": "tested-where-its-owned"
        }
      ]
    }
  ],
  "breachUsuallySits": "in missing unit tests and ports",
  "seenBy": [
    "files"
  ],
  "reports": "seen",
  "recipes": [
    "integration-test-suffix",
    "companion-test-file"
  ],
  "correctUses": []
}
```

- **How it is seen:** files (by the integration test suffix).
