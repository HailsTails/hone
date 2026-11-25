# Adapter per outside party

```json
{
  "serves": [
    {
      "rule": "outside-dependencies-stay-at-boundaries"
    },
    {
      "principle": "no-leak-across-a-boundary"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"I didn't want a json parse wrapper. I wanted a boundary on whoever made json\"; \"Json parse has no contract… Http fetch library for example has complexity to bind\".",
    "standing": "accepted"
  }
}
```

- **Method:** An outside dependency or runtime module is imported only in the adapter file for the party it reaches. That adapter fulfils a port and returns our types. Nothing re-exports the outside dependency. `JSON.parse` is called inside the adapter for whoever produced the JSON.
- **You can tell because:** Each package import sits in a file with an authorised location bound to that party.
- **Industry name:** Adapter; Gateway; anticorruption layer; Hexagonal Architecture (Cockburn).
