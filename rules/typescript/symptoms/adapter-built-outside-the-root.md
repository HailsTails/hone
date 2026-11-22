# Adapter built outside the root

```json
{
  "seen": "A call to an adapter's factory anywhere but the entry point.",
  "mayIndicate": [
    {
      "case": "builds-the-real-implementations",
      "points": [
        {
          "rule": "ports-declared-inside"
        },
        {
          "rule": "doer-or-orchestrator"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the calling unit, which builds what it should be passed",
  "recipes": [
    "composition-root"
  ],
  "correctUses": []
}
```
