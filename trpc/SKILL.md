---
name: trpc
description: Calls any procedure on a tRPC v10 or v11 server from the command line and prints its result as JSON, signing in once and sending the saved token on later calls, with superjson and Temporal values supported. Use when calling, testing, or debugging a tRPC API from a terminal or script, signing in to one, or seeding data through its procedures instead of clicking through the app.
---

Rule: call a procedure via `deno task --config <path to scratch>/deno.json trpc <procedure> [<json-input>]` from the project's root
Reason: the tool reads the `tools.config.json` in the directory `deno task` was called from, so a call from a subdirectory or the scratch repo finds no url

Rule: declare the server in the project's `tools.config.json` under `trpc`, as `{ "trpc": { "url": "http://localhost:3000/api/trpc" } }`
Reason: the tool knows no server of its own and refuses a call with no url

Rule: set `url` to where the server mounts its tRPC handler, so that `<url>/<procedure>` is a procedure's endpoint
Reason: the tool appends the dotted procedure path to the url as written

Rule: set `transformer` to `superjson` for a server created with `transformer: superjson`, and leave it out for one without
Reason: it defaults to `none`, and a mismatch in either direction fails or prints the superjson envelope rather than the result

Rule: pass `--url <url>` to reach another server for one run
Reason: the flag wins over the config, and each url keeps its own saved token

Rule: name the procedure by its dotted path through the router, as `post.byId`
Reason: the path is the procedure's endpoint under the url

Rule: pass the input as one JSON argument, quoted so the shell keeps it whole, and leave it out for a procedure that takes none
Reason: the tool sends no input at all when the argument is absent, rather than an empty object

Rule: put `--` before an input that starts with a dash, as `trpc post.byId -- -5`
Reason: the argument parser reads a leading dash as a flag and refuses it as unknown

Rule: call queries and mutations the same way
Reason: the tool finds a procedure's kind itself, so no flag names it

Rule: write a Temporal value in the input as a marked string, such as `"@instant:2026-07-01T15:00:00Z"`
Reason: an unmarked string is sent as a string however much it looks like a date

Rule: choose among the markers `@instant:`, `@zoneddatetime:`, `@plaindatetime:`, `@plaindate:`, `@plaintime:`, `@plainyearmonth:`, `@plainmonthday:`, and `@duration:`, each followed by the value's ISO 8601 form
Reason: the tool refuses a marked value that does not parse, naming it

Rule: expect a marked value to reach a superjson server as a `Temporal.<Type>` custom value, and a server without a transformer as its ISO string
Reason: the server reads the tag only if it registers a codec under that name, as `Temporal.Instant`

Rule: list the procedures that sign in under `session.procedures`, with `session.tokenPath` as the dotted path to the token in their result
Reason: a successful call to one of them saves that token, as `{ "procedures": ["auth.login"], "tokenPath": "session.access_token" }`

Rule: expect a sign-in whose result holds no token string at `session.tokenPath` to print its result, save nothing, and exit 1 naming the path
Reason: the result prints before the token is read, so stdout carries an answer even though the run failed

Rule: set `auth.header` and `auth.prefix` when the server reads its token other than as `authorization: Bearer <token>`
Reason: those are the defaults, and a server reading a bare token takes `"prefix": ""`

Rule: expect a saved token to go only to the url it was saved for, and a call whose url redirects to be refused
Reason: a run pointed elsewhere with `--url` sends no token, and a url that redirects needs the final address set in its place

Rule: check whether a token is saved for the url with `trpc status`, which prints `{ "url", "signedIn" }` on stdout without calling the server
Reason: who the token belongs to is a question for the server's own procedure

Rule: forget the token saved for the url with `trpc logout`, which prints `signed out of <url>` on stderr
Reason: the other urls' tokens stay saved

Rule: expect a procedure at the router's root named `status` or `logout` to be out of reach
Reason: the tool reads those two words as its own commands before it reads them as a procedure

Rule: read a procedure's result as pretty-printed JSON on stdout, with a void result printed as `null`, and progress such as `saved session for <url> to <path>` on stderr
Reason: a caller piping the output through `jq` gets the result alone

Rule: expect a superjson result in superjson's JSON form, with a BigInt as a string, a Map as its entries, a Set as an array, and a Temporal value as its ISO string
Reason: a BigInt keeps every digit only as a string, so a caller compares it as one

Rule: expect a non-zero exit on bad input, an unreachable server, an undecodable answer, or any tRPC error, which prints as `tRPC error (<status>): <message>`
Reason: a script can tell a failure from a result by the exit code

Rule: do not commit or share `~/.trpc/sessions.json`
Reason: it holds live tokens, which is why the tool writes it owner-only in a directory of its own

Rule: expect the task to run with `--allow-read`, `--allow-write` on `~/.trpc` alone, `--allow-env=HOME,INIT_CWD`, and `--allow-net`
Reason: the tool reads the config, writes only the sessions file, and reaches whatever server the url names
