import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseConfig, protocolPattern, resolveUrl, toContextOptions } from './config.ts'

describe('All Playwright Debug Config Tests', () => {
  describe('protocolPattern', () => {
    it('matches the schemes a page opens from', () => {
      // Act & Assert
      assertEquals(protocolPattern.test('http'), true)
      assertEquals(protocolPattern.test('https'), true)
      assertEquals(protocolPattern.test('about'), true)
      assertEquals(protocolPattern.test('data'), true)
      assertEquals(protocolPattern.test('file'), true)
    })

    it('refuses a host read as a scheme, which a url missing its scheme becomes', () => {
      // Act & Assert
      assertEquals(protocolPattern.test('localhost'), false)
      assertEquals(protocolPattern.test('foo'), false)
    })

    it('refuses a scheme that only contains or starts like an allowed one', () => {
      // Act & Assert
      assertEquals(protocolPattern.test('xhttp'), false)
      assertEquals(protocolPattern.test('httpss'), false)
      assertEquals(protocolPattern.test('https:'), false)
    })

    it('refuses a script scheme and an empty scheme', () => {
      // Act & Assert
      assertEquals(protocolPattern.test('javascript'), false)
      assertEquals(protocolPattern.test(''), false)
    })

    it('refuses a scheme carrying a newline, which the end anchor does not let past', () => {
      // Act & Assert
      assertEquals(protocolPattern.test('http\n'), false)
      assertEquals(protocolPattern.test('ht\ntp'), false)
    })
  })

  describe('parseConfig', () => {
    it('reads the url and the storage state path', () => {
      // Act
      const config = parseConfig('{ "playwright-debug": { "url": "https://localhost:3001/tasks", "storageState": ".auth/user.json" } }')

      // Assert
      assertEquals(config, { url: 'https://localhost:3001/tasks', storageState: '.auth/user.json' })
    })

    it('reads an absent section as no url and no storage state', () => {
      // Act
      const config = parseConfig('{ "tmux": { "session": "dev" } }')

      // Assert
      assertEquals(config, {})
    })

    it('refuses a misspelled key rather than ignoring it', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "playwright-debug": { "storage": ".auth/user.json" } }'), CliError, 'playwright-debug section the tool cannot read')
    })

    it('refuses a url that does not parse', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "playwright-debug": { "url": "tasks/manage" } }'), CliError, 'playwright-debug section the tool cannot read')
    })

    it('refuses a url missing its scheme, which would otherwise parse with the host as the scheme', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "playwright-debug": { "url": "localhost:3001" } }'), CliError, 'playwright-debug section the tool cannot read')
      assertThrows(() => parseConfig('{ "playwright-debug": { "url": "localhost:3001/tasks" } }'), CliError, 'playwright-debug section the tool cannot read')
      assertThrows(() => parseConfig('{ "playwright-debug": { "url": "foo:bar" } }'), CliError, 'playwright-debug section the tool cannot read')
    })

    it('refuses an empty storage state path, which would name no file', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "playwright-debug": { "storageState": "" } }'), CliError, 'playwright-debug section the tool cannot read')
    })

    it('refuses a null section', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "playwright-debug": null }'), CliError, 'playwright-debug section the tool cannot read')
    })
  })

  describe('resolveUrl', () => {
    it('opens the configured url', () => {
      // Act & Assert
      assertEquals(resolveUrl(undefined, { url: 'https://localhost:3001/tasks' }), 'https://localhost:3001/tasks')
    })

    it('lets the flag outrank the config', () => {
      // Act & Assert
      assertEquals(resolveUrl('about:blank', { url: 'https://localhost:3001/tasks' }), 'about:blank')
    })

    it('refuses to run when neither the flag nor the config names a page', () => {
      // Act
      const error = assertThrows(() => resolveUrl(undefined, {}), CliError, 'No page to open')

      // Assert
      assertEquals(error.suggestions, ['Pass --url <url>', 'Or set "url" under "playwright-debug" in tools.config.json'])
    })

    it('refuses a flag that does not parse as a url before any browser opens', () => {
      // Act & Assert
      assertThrows(() => resolveUrl('tasks/manage', {}), CliError, 'Invalid --url value: "tasks/manage"')
    })

    it('refuses a flag missing its scheme before any browser opens', () => {
      // Act & Assert
      assertThrows(() => resolveUrl('localhost:3001', {}), CliError, 'Invalid --url value: "localhost:3001"')
      assertThrows(() => resolveUrl('localhost:3001/tasks', {}), CliError, 'Invalid --url value: "localhost:3001/tasks"')
      assertThrows(() => resolveUrl('foo:bar', {}), CliError, 'Invalid --url value: "foo:bar"')
    })

    it('opens a data or file url', () => {
      // Act & Assert
      assertEquals(resolveUrl('data:text/html,<title>x</title>', {}), 'data:text/html,<title>x</title>')
      assertEquals(resolveUrl('file:///work/app/index.html', {}), 'file:///work/app/index.html')
    })

    it('refuses an empty flag rather than falling back to the configured url', () => {
      // Act & Assert
      assertThrows(() => resolveUrl('', { url: 'https://localhost:3001/tasks' }), CliError, 'Invalid --url value: ""')
    })
  })

  describe('toContextOptions', () => {
    it('resolves a relative storage state path against the calling directory', () => {
      // Act
      const options = toContextOptions({ storageState: '.auth/user.json' }, '/work/app')

      // Assert
      assertEquals(options, { ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 }, storageState: '/work/app/.auth/user.json' })
    })

    it('keeps an absolute storage state path as written', () => {
      // Act
      const options = toContextOptions({ storageState: '/home/me/state.json' }, '/work/app')

      // Assert
      assertEquals(options, { ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 }, storageState: '/home/me/state.json' })
    })

    it('loads no storage state when the config names none', () => {
      // Act
      const options = toContextOptions({}, '/work/app')

      // Assert
      assertEquals(options, { ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } })
    })
  })
})
