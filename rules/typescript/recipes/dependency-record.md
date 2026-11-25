# Dependency record

```json
{
  "serves": [
    {
      "rule": "outside-dependencies-justified"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"Packages need a justification for the maintenance they add.\"",
    "standing": "accepted"
  }
}
```

- **Method:** One [dependency record](../../record-kinds/dependency-record.md) per direct dependency, tools included, names the native way weighed and why it fell short.
- **You can tell because:** Every entry in `package.json` has a record.
- **Industry name:** architecture decision record (Nygard).

Proposed, not accepted: the case An adopter is not handed our risk, under Outside dependencies justified. A peer dependency is a direct dependency of ours, so it needs a record. The risk it weighs is carried by whoever runs it, the adopter included.
