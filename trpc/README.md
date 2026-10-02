# trpc

Calls a procedure on a tRPC server from the command line and prints its result as JSON.

## What it does

It calls through `@trpc/client`'s untyped client, which takes a procedure as a dotted string rather than through the router's types.
The library handles the wire format, the error shape, and the transformer, so the tool works against any tRPC v10 or v11 server answering over HTTP without knowing its router.

A procedure's kind is unknown from its name, so the tool sends a mutation first.
A server refuses a mutation sent to a query before running the procedure, with 405 in v11 and a 404 naming the missing mutation in v10, and the tool retries that call as a query.
The server still builds its request context for the refused call, so a query runs the server's context factory twice.

A server either sends plain JSON or wraps it with superjson, and the `transformer` setting says which.
superjson reads a payload with no envelope as undefined, so the tool refuses one rather than printing `null` for a server that answered plainly.
The tool prints the JSON half of the envelope rather than rebuilding the values it describes, since JSON cannot print a BigInt, a Map, or a Set.

JSON has no date type, so a Temporal value in the input is written as a marked string.
With superjson the value travels tagged with its type's name, such as `Temporal.Instant`.

Signing in is a call like any other.
The procedures the project lists under `session.procedures` save the token found at `session.tokenPath` in their result, and later calls to the same url send it in the configured header.
Tokens are saved per url in `~/.trpc/sessions.json`, written owner-only.
The tool refuses to follow a redirect, since fetch drops only the `authorization` header when one crosses origins and a token in any other header would travel with it.

The pure logic sits in modules that test without permissions: the config section and the url in `config.ts`, the saved sessions, the auth header, and the token path in `session.ts`, the markers and codecs in `temporal.ts`, the superjson envelope in `transformer.ts`, and the retry decision and error messages in `error.ts`.
`client.ts` owns the call and `store.ts` owns the sessions file.

## Unsupported

**Subscriptions.**
The tool makes one request and exits, and a stream needs a second mode that reads until interrupted.

**Cookie auth.**
A token is read from a result and sent in a header, which covers servers that hand one out, while a cookie session would need the response headers saved as well.

**Transformers other than superjson.**
superjson is the transformer tRPC documents, and each other one would be another codec to carry.

**Batching.**
One call is one request, so there is nothing to batch.

## Common issues

**"No server url" from a project that sets one.**
The call came from a directory other than the project's root, such as a subdirectory or the scratch repo, so the tool read another directory's `tools.config.json`.
Call again from the project's root with `deno task --config <path to scratch>/deno.json trpc`.

**A result printed as `{ "json": ... }`.**
The server uses superjson and the config does not say so.
Set `transformer` to `superjson`.

**"could not be decoded".**
The config says superjson and the server answered plain JSON, or the url names a route other than the tRPC handler.
Set `transformer` to `none`, or point `url` at the handler.

**"is not tRPC JSON".**
The url names a web page rather than the tRPC handler, often by missing its mount path such as `/trpc`, or the procedure is a subscription.
Point `url` at the handler.

**"redirects, which the tool does not follow".**
The url answers with a redirect, such as one from http to https, which the tool refuses to follow.
Set `url` to the address the redirect points at.

**A 401 right after signing in.**
The server reads the token from another header or without the `Bearer ` prefix.
Set `auth.header` and `auth.prefix` to what the server reads, such as `"prefix": ""` for a bare token.

**A marked value the server reads as a string.**
The server has no transformer, or registers no codec under the `Temporal.<Type>` name.
A server without superjson receives the ISO string, which its input schema has to accept as one.
