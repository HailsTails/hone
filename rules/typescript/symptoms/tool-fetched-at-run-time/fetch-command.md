# fetch-command

```json
{
  "misses": "Indirect commands composed through aliases or variables and commands split across physical lines.",
  "settingsTracedTo": "None."
}
```

Direct fetch-and-run commands in package scripts, CI workflows, and shell scripts.

The check includes `pnpx` and reads each command line in a multiline workflow `run` block.
