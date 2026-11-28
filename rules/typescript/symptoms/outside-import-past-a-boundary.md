# Outside import past a boundary

```json
{
  "group": "The outside world reached directly",
  "seen": "An import, `import()` or `require` of an outside dependency or runtime module (`node:*`) in a file with no authorised location for that outside party.",
  "mayIndicate": [
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "rule": "outside-dependencies-stay-at-boundaries"
        },
        {
          "rule": "ports-declared-inside"
        }
      ]
    },
    {
      "case": "takes-an-outside-dependency",
      "points": [
        {
          "rule": "outside-dependencies-stay-at-boundaries"
        }
      ]
    }
  ],
  "breachUsuallySits": "at a missing adapter and port",
  "seenBy": [
    "graph"
  ],
  "reports": "seen",
  "recipes": [
    "adapter-per-outside-party",
    "port-in-a-module-of-its-own"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "authorised-location",
      "at": "on the adapter for that outside party",
      "binds": ["outside-party"]
    }
  ]
}
```
