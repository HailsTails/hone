# Port in the domain

```json
{
  "serves": {
    "rule": "ports-declared-inside"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"In clean architecture the port is domain and to be kept separate to the concrete implementation or use.\"; \"then host facts source should be declared separately to its concrete implementation to protiect dependency inversion\".",
    "standing": "accepted"
  }
}
```

- **Method:** The port's interface is declared in the domain, in a module of its own, named for the capability. It sits apart from the adapter that fulfils it and from the unit that uses it; both import it from there. Storage is such a port, named for what the domain asks.
- **You can tell because:** No port is declared in an adapter's module or in its consumer's. No business-logic file imports an adapter. No query or driver type in business logic.
- **Industry name:** dependency inversion (Martin); Clean Architecture.
- **Review:** storage sits behind a repository port and domain code never imports a storage driver
