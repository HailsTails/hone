# Entity module

```json
{
  "serves": {
    "rule": "handed-what-it-uses"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"The anaemic concern there is that by writing types with no logic you are failing coupling/cohesion and single responsibility principles.\"",
    "standing": "accepted"
  }
}
```

- **Method:** An entity's type and its logic share one module. Its functions take the entity.
- **You can tell because:** No file holds only types, except port declarations.
- **Industry name:** DDD entity (Evans).

Entity module also serves One reason per module.
