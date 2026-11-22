# No leak across a boundary

```json
{}
```

- **Must hold:** Data and failures cross a boundary only through an adapter that maps between their outside form and a type of our own.
- **Protects:** A sender's change of shape stops at the adapter.
- **Reason to change:** The shape of the data we receive changes.
- **Breach:** In the adapter that is missing or passes the outside form inward. Shows far inward: presence checks, re-parsing, casts.
- **Outside data:** anything read at a boundary, our own stored rows and files included.
- **Record:** an externally defined model adopted as the definitive thing. Evans's *Conformist*. It is a statement on a [boundary record](../record-kinds/boundary-record.md).
- **Source:** This is Evans's anticorruption layer, applied to failures as well as data, in both directions.
- **Quoted reasons:** "we always map to our own type to decouple even if they are basically the same contents." "Throws are not about start up. They are about speaking the language of the caller at the boundary."
