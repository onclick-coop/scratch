import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseConfig, resolveSettings } from './config.ts'

const section = (testReport: unknown): string => JSON.stringify({ 'test-report': testReport })

describe('All Test Report Config Tests', () => {
  describe('parseConfig', () => {
    it('reads every setting a project gives', () => {
      // Arrange
      const text = section({
        directory: 'server',
        glob: 'src/**/*.test.ts',
        args: ['task', 'test:run'],
        report: 'reports/tests.md',
        state: 'reports/tests.json',
      })

      // Act
      const config = parseConfig(text)

      // Assert
      assertEquals(config, {
        directory: 'server',
        glob: 'src/**/*.test.ts',
        args: ['task', 'test:run'],
        report: 'reports/tests.md',
        state: 'reports/tests.json',
      })
    })

    it('reads an absent section as every test file under the project, run with deno test', () => {
      // Act
      const config = parseConfig('{ "commit": {} }')

      // Assert
      assertEquals(config, { directory: '.', glob: '**/*.test.ts', args: ['test'] })
    })

    it('refuses a misspelled key rather than running every file the default glob matches', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ globs: 'src/**/*.test.ts' })), CliError, 'Unrecognized key: "globs"')
    })

    it('refuses args written as one string, which deno would read as a single argument', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ args: 'task test:run' })), CliError, 'test-report section the tool cannot read')
    })

    it('refuses empty args, which would hand deno the test file as a script to run', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ args: [] })), CliError, 'test-report section the tool cannot read')
    })

    it('refuses an empty path, which would name the project directory itself', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ directory: '' })), CliError, 'test-report section the tool cannot read')
      assertThrows(() => parseConfig(section({ report: '' })), CliError, 'test-report section the tool cannot read')
      assertThrows(() => parseConfig(section({ state: '' })), CliError, 'test-report section the tool cannot read')
    })

    it('refuses an empty glob, which would match no test file', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ glob: '' })), CliError, 'test-report section the tool cannot read')
    })

    it('refuses a null section', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section(null)), CliError, 'test-report section the tool cannot read')
    })
  })

  describe('resolveSettings', () => {
    it('names the report and state under /tmp for the project directory and a hash of its path by default', async () => {
      // Act
      const settings = await resolveSettings(parseConfig('{}'), '/work/acme')

      // Assert
      assertEquals(settings, {
        directory: '/work/acme',
        glob: '**/*.test.ts',
        args: ['test'],
        reportPath: '/tmp/acme-e3b8fe59-test-report.md',
        statePath: '/tmp/acme-e3b8fe59-test-report.json',
      })
    })

    it('gives two projects sharing a directory name different default files', async () => {
      // Act
      const settings = await resolveSettings(parseConfig('{}'), '/work/other/acme')

      // Assert
      assertEquals(settings.statePath, '/tmp/acme-70bb49d9-test-report.json')
    })

    it('resolves relative paths against the project directory', async () => {
      // Act
      const settings = await resolveSettings(parseConfig(section({ directory: 'server', report: 'out/tests.md', state: 'out/tests.json' })), '/work/acme')

      // Assert
      assertEquals(settings.directory, '/work/acme/server')
      assertEquals(settings.reportPath, '/work/acme/out/tests.md')
      assertEquals(settings.statePath, '/work/acme/out/tests.json')
    })

    it('takes absolute paths as written', async () => {
      // Act
      const settings = await resolveSettings(parseConfig(section({ directory: '/srv/app', state: '/var/tmp/s.json' })), '/work/acme')

      // Assert
      assertEquals(settings.directory, '/srv/app')
      assertEquals(settings.statePath, '/var/tmp/s.json')
    })
  })
})
