# Machine touched in a unit test

```json
{
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
  "recipes": [
    "integration-test-owns-its-scratch",
    "integration-test-suffix",
    "ports-in-the-argument"
  ],
  "correctUses": []
}
```
