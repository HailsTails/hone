# Outside import past a boundary

```json
{
  "seen": "An import, `import()` or `require` of an outside dependency or runtime module (`node:*`) in a file with no boundary record.",
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
  "recipes": [
    "adapter-per-outside-party",
    "port-in-the-domain"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "boundary-record",
      "at": "on the adapter for that outside party"
    }
  ]
}
```
