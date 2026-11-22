# Machine touched in a unit test

```json
{
  "group": "Tests",
  "seen": "A unit test that reads or writes files, spawns a process, opens a socket or makes a temp directory.",
  "mayIndicate": [
    {
      "case": "tests-across-units-or-against-a-real-system",
      "points": [
        {
          "rule": "tested-where-its-owned"
        }
      ]
    },
    {
      "case": "uses-what-a-collaborator-gives-back",
      "points": [
        {
          "rule": "written-out-answers"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit, which has no port, or in a test that is an integration test misnamed",
  "seenBy": [
    "syntax",
    "files"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "integration-test-owns-its-scratch",
    "integration-test-suffix",
    "ports-in-the-argument"
  ],
  "correctUses": []
}
```

- **The breach a check could name:** the unit with no port.
- **To name the breach, a check needs:** graph: what the unit imports.
