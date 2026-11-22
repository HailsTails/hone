# Inherited environment in a subprocess

```json
{
  "seen": "A process spawned in a test with no explicit environment, or one built from `process.env`.",
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
  "breachUsuallySits": "at the spawn site",
  "recipes": [
    "integration-test-owns-its-scratch"
  ],
  "correctUses": []
}
```
