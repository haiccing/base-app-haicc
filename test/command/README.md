# test/command/

The package's own test: its program run as a command line, each run a process of its own.

The program is started through the package's dispatcher, as a platform's
`haicc` starts it, on a home folder made for the test. A folder stands in
for the root mrepo: the test answers what arrives in its inbox, as a
runtime would. No runtime is started.

## What it checks

- **The usage**: printed for `--help`, `help`, `-h` and nothing; every
  form of the command line is in it.
- **Not a command**: exit 2, said on stderr, nothing printed, for each
  way a command line can be wrong.
- **Nothing booted**: a command for the mrepos and `boot/deploy` with
  no source holding the boot component, each said, exit 3;
  `boot/teardown` a repeat, a warning, exit 0; nothing written.
- **`haicc sources`**: the two lists read, the internal first, a line
  not read said; `unlink` from either; `https` and `no-https` gone; a
  download, with the lists as written after.
- **A command's record, value by value**: the envelope addressed to the
  root's inbox, around a request: its line as typed, who asks, its
  answer back to the terminal; plain at the root, the `haicc` command elsewhere; a
  first word `/run`, passed on as typed.
- **What is returned**: what it says printed, as it is; `--request`,
  the whole request unpacked to the width, and packed again the record
  as stored; the width set with `haicc output` and back to `auto`;
  `--raw` and the variables; failed, exit 1, said on stderr; a request
  not returned, exit 5; none in time, exit 4.
- **`boot/teardown`**: what the deploy put in place removed by name, the
  packages' scripts too, the user's and the rest of the work folder
  kept; twice, a repeat.
- **Nothing forgotten**: the last test fails when a kind of command line
  was not run here.

## Not here

The boot really run, a runtime really stopped, and commands answered by
running mrepos: they need Bare installed and the sources, so they are in
the end to end test of the platform's first step,
`haiccing/base-linux-haicc`.
