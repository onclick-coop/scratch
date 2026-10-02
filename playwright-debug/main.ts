import { parseArgs } from '@std/cli/parse-args'
import { resolve, toFileUrl } from '@std/path'
import { chromium } from 'playwright'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { DEFAULT_PORT, parsePort, toCommand } from './args.ts'
import { parseConfig, resolveUrl, toContextOptions } from './config.ts'
import { toDriver } from './driver.ts'

const KNOWN_FLAGS = new Set(['help', 'h', 'url', 'port', 'p'])

const args = parseArgs(Deno.args, {
  string: ['url', 'port'],
  boolean: ['help'],
  alias: { h: 'help', p: 'port' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: playwright-debug <command> [argument] [--port <port>] [--url <url>]',
    '',
    'Spawns a headed chromium that exposes the DevTools protocol, or runs a driver script against it.',
    '',
    'Commands:',
    '  spawn                  Open a browser on the page and keep it open until Ctrl+C',
    "  attach <driver-path>   Run the driver's default export against the spawned browser, leaving it open",
    '',
    'Options:',
    '  --url <url>            Page spawn opens (default: the playwright-debug url in tools.config.json)',
    `  --port, -p <port>      DevTools protocol port (default: ${DEFAULT_PORT})`,
    '  --help, -h             Show this help',
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const log = (message: string): void => console.error(`[playwright-debug] ${message}`)

const spawn = async (port: number): Promise<void> => {
  const directory = callerDirectory()
  const config = parseConfig(await readConfigText(directory))
  const url = resolveUrl(args.url, config)
  const contextOptions = toContextOptions(config, directory)

  const { storageState } = contextOptions
  if (storageState) {
    const { error } = await safeAsync(() => Deno.stat(storageState))
    if (error) throw new CliError(`Failed to read the storage state at ${storageState}: ${error.message}`, ['Fix storageState under playwright-debug in tools.config.json'])
  }

  const browser = await chromium.launch({
    headless: false,
    args: [`--remote-debugging-port=${port}`],
  })

  const closed = new Promise<void>((resolve) => browser.on('disconnected', () => resolve()))
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  // Closing the browser removes the profile Playwright made for it in the temporary directory.
  const { error: gotoError } = await safeAsync(() => page.goto(url))
  if (gotoError) {
    await browser.close()
    const [reason] = gotoError.message.split('\n')
    throw new CliError(`Failed to open ${url}: ${reason}`, [`Is the server at ${url} running?`, 'Or pass --url naming a page that loads'])
  }

  log(`browser ready on CDP port ${port}`)
  log(`navigated to ${url}`)
  log('press Ctrl+C to exit')

  await closed
  log('browser closed')
}

const attach = async (driverPath: string, port: number): Promise<void> => {
  const path = resolve(callerDirectory(), driverPath)
  const { data: module, error: importError } = await safeAsync((): Promise<unknown> => import(toFileUrl(path).href))
  if (importError) throw new CliError(`Failed to load the driver at ${path}: ${importError.message}`, ['Pass the path of a module, relative to the directory the task is called from'])

  const driver = toDriver(module, path)

  const { data: browser, error: connectError } = await safeAsync(() => chromium.connectOverCDP(`http://localhost:${port}`))
  if (connectError) {
    const [reason] = connectError.message.split('\n')
    throw new CliError(`Failed to connect to a browser on CDP port ${port}: ${reason}`, ['Run spawn first', 'Pass --port naming the port spawn was given'])
  }

  const [context] = browser.contexts()
  if (!context) throw new CliError(`The browser on CDP port ${port} has no context`, ['Run spawn, which opens one'])

  const [page] = context.pages()
  if (!page) throw new CliError(`The browser on CDP port ${port} has no page`, ['Run spawn again, which opens one'])

  log(`attached on CDP port ${port}, running ${path}`)
  await driver({ browser, context, page })
  await browser.close()
}

const run = async (): Promise<void> => {
  const unknownFlags = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
  const command = toCommand({ positionals: args._.map(String), unknownFlags, hasUrl: args.url !== undefined })
  const port = parsePort(args.port)

  if (command.name === 'attach') {
    await attach(command.driver, port)
    return
  }

  await spawn(port)
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
