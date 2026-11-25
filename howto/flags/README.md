# flags

Flags given to a command: how much its log holds, the layer it reads, a script to go on with.

Flags belong to a step of the command: after the last command's URI,
the last command's, to the end of the line; after a URI followed by
`--`, that step's, holding down the chain until changed.

## Steps

The script, [steps.haicc](steps.haicc): each line as typed after `haicc`, what it answers under it; run with `howto/run`, shown here at info extraction.

## Notes

- **`log`**: `info` (without it), `verbose`, `debug`. **`layer`**:
  `main` without it. **`container`**: on a deploy, the child on its own
  haicc install in a Docker container.
