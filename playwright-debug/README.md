# playwright-debug

Keeps one headed Playwright chromium open for debugging a web UI, and runs short driver scripts against it.

## What it does

`spawn` launches a headed chromium with its DevTools protocol on a port, opens a new context, loads the page, and waits until the browser goes away.
The context loads the project's saved storage state when one is configured, accepts self-signed certificates so a local dev server over https opens, and draws a 1920 by 1080 viewport.
Ctrl+C and closing the window both end the run, since Playwright closes the browser on an interrupt and the tool returns once the browser disconnects.

`attach` connects over CDP, hands the driver the first context's first page, and disconnects when the driver returns.
Disconnecting from a browser Playwright connected to rather than launched leaves that browser running, which is what keeps the session warm between drivers.

The Playwright dependency is pinned to one exact version, because each release drives one chromium build and a range would move the tool onto a build nobody installed.

The argument rules sit in `args.ts`, the config section, the page url, and the context options in `config.ts`, and the driver module check in `driver.ts`, all tested without permissions.
`main.ts` holds the CLI dispatch and every call into Playwright.

The write permission covers any path, because Playwright puts the browser profile and its artifacts in the temporary directory, which moves with the platform and with `TMPDIR`, and a deno task cannot fall back to a default for an unset variable.
The env permission covers every variable, because Playwright reads many of them and hands chromium the whole environment.
The run permission covers any program, because the chromium binary sits in a version-numbered directory of the Playwright cache, which `PLAYWRIGHT_BROWSERS_PATH` can move.
The net permission reaches only loopback hosts, which attach dials for the DevTools protocol and spawn does not use at all.
The sys permission names the three values Playwright reads, the OS release, the home directory, and the user id.

## Unsupported

Nothing has been proposed and declined yet.

## Common issues

**attach fails with "Failed to connect to a browser on CDP port".**
No spawn is running on that port, or the spawn was given another one.
Run spawn first, or pass attach the same `--port`.

**spawn fails with "Executable doesn't exist".**
The chromium build for the pinned Playwright version is not installed.
Install it as the SKILL's setup step shows.
