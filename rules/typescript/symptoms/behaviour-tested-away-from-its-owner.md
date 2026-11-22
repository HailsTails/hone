# Behaviour tested away from its owner

```json
{
  "group": "Tests",
  "seen": "A unit test that asserts what a collaborator does, or an integration test that pins a rule a unit owns.",
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
      "case": "gives-each-unit-its-test",
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
  "breachUsuallySits": "in the level the test is written at",
  "seenBy": [
    "person",
    "graph"
  ],
  "recipes": [
    "companion-test-file",
    "integration-test-suffix"
  ],
  "correctUses": []
}
```
