---
name: playwright-debug
description: Spawns a long-lived headed Playwright chromium that exposes the DevTools protocol, and runs one-shot driver scripts against it over CDP while the browser stays open. Use when debugging a web UI interactively, iterating on selectors, timing, or flaky steps against one warm browser session, instead of relaunching a browser per test with playwright test --debug or --headed.
---

Rule: run the tool from a project's root as `deno task --config <path to scratch>/deno.json playwright-debug <command>`
Reason: the tool reads the `tools.config.json` in the directory the task is called from, and resolves the storage state and driver paths against that directory

Rule: install the chromium build for the Playwright version `playwright-debug/deno.json` pins, with `deno run -A npm:playwright@<that version> install chromium`, before the first spawn
Reason: each Playwright release launches one chromium build, and spawn refuses to start when that build is missing

Rule: set the page spawn opens and the saved session it loads in the `playwright-debug` section of the project's `tools.config.json`, as `{ "playwright-debug": { "url": "https://localhost:3000/", "storageState": ".auth/user.json" } }`
Reason: the tool has no default page, since which page to open belongs to the project

Rule: give the `playwright-debug` section only `url` and `storageState`, and leave out either one the project has no use for
Reason: the tool refuses a misspelled key, an empty storage state path, and a url without an http, https, about, data, or file scheme, rather than running as though the setting were absent

Rule: point `storageState` at the file a Playwright suite saves with `context.storageState({ path })`, written relative to the project's root or as an absolute path
Reason: spawn loads it into the browser's context so the session starts signed in, and refuses to open a browser when the file cannot be read

Rule: leave out `storageState` to start a session with no saved cookies or storage
Reason: spawn then opens a fresh context

Rule: start the browser with `spawn`, which opens the page and stays running until Ctrl+C or until the browser window is closed
Reason: a long-lived browser keeps its cache and connections warm, so each driver run meets the steady state a suite reaches after its setup

Rule: pass `--url <url>` on `spawn` to open another page for one run
Reason: the flag outranks the config, spawn refuses to run when neither names a page, and it closes the browser and exits 1 when the page fails to load

Rule: pass `--port <port>` (`-p`) to choose the DevTools protocol port, which defaults to 9222
Reason: spawn exposes the browser on that port and attach connects to it, so both need the same value

Rule: write `--port` as plain digits between 1 and 65535, after the command rather than as a bare number
Reason: the tool refuses a port written as an argument, an empty value, and anything outside the range

Rule: give each spawn a port no other browser holds, and stop one spawn before giving its port to another
Reason: a spawn on a port another browser already holds still reports ready, and attach then reaches either browser

Rule: run a driver with `attach <driver-path>`, written relative to the directory the task is called from
Reason: attach loads the driver, connects to the browser on the port, runs the driver once against the first page, and exits leaving the browser open

Rule: write a driver as a small `.ts` module whose default export is a function taking `{ browser, context, page }`, sync or async
Reason: attach refuses a module whose default export is not a function before it connects to the browser

Rule: keep driver scripts in the project they debug, one file per investigation
Reason: attach reads a driver from any path, and a driver that goes with its project is reviewable beside the code it checks

Rule: drive the session through `page`, and read cookies or storage through it, as `page.evaluate(() => document.cookie)`
Reason: over CDP the page spawn opened belongs to the context Playwright treats as the browser's default, so `context.cookies()`, `context.storageState()`, and `context.newPage()` reach a context without the saved session

Rule: expect a driver to run with the tool's permissions, which reach the network on loopback hosts alone
Reason: the driver runs inside the tool's process, so a `fetch` or a `page.request` call to another host is refused, while the browser itself loads any page

Rule: expect the status lines on stderr, prefixed `[playwright-debug]`, and a driver's own output wherever the driver writes it
Reason: a caller piping attach's stdout gets what the driver printed and nothing else

Rule: expect a refused input to exit 1 with `error:` and a suggestion on stderr, and a driver that throws to exit 1 with its stack trace
Reason: a refusal names the fix, while a failure inside the driver is a bug in the driver whose trace says where

Rule: run a test suite with its own runner, never through the spawned browser
Reason: a suite expects a fresh browser per spec, while this browser is one pinned session

Rule: prefer this tool over `playwright test --debug` and `playwright test --headed` when investigating flakiness or selector ambiguity
Reason: those modes recycle the browser per test, while this tool keeps one session so a single step can be replayed many times

Rule: pass `--help` or `-h` to print the usage block
Reason: lists the commands and the options without leaving the terminal
