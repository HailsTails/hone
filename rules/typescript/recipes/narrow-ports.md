# Narrow ports

```json
{
  "serves": {
    "rule": "handed-what-it-uses"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"Rather than writing 6 different concrete things 1 for each.\"; \"narrowed ports that still help us find the seams where the dependencies link up\".",
    "standing": "accepted"
  }
}
```

- **Method:** A port interface lists only the methods its one consumer calls. One adapter fulfils several narrow ports.
- **You can tell because:** Each port's methods are all called by its consumer.
- **Industry name:** role interface (Fowler); Interface Segregation.
