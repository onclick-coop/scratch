import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { applyMutation, assertAnchors, assertArgs, formatSummary, formatVerdict, readPlan, survivors, type Verdict } from './parse.ts'

// The keys parseArgs returns for `--plan plan.json`, which sets every alias and the help default alongside the flag.
const clean = { positionals: [], keys: ['_', 'plan', 'p', 'help', 'h'], plan: 'plan.json', help: false }

const caught = (name: string): Verdict => ({ name, source: 'src/a.ts', caught: true })
const survived = (name: string): Verdict => ({ name, source: 'src/a.ts', caught: false })

describe('All Mutate Parse Tests', () => {
  describe('assertArgs', () => {
    it('accepts a run naming a plan by its long flag', () => {
      // Act & Assert
      assertArgs(clean)
    })

    it('accepts a run naming a plan by its short flag', () => {
      // Act & Assert
      assertArgs({ ...clean, keys: ['_', 'p', 'plan', 'help', 'h'] })
    })

    it('accepts a run naming a source by either flag', () => {
      // Act & Assert
      assertArgs({ ...clean, keys: ['_', 'source', 's', 'plan', 'p', 'help', 'h'] })
      assertArgs({ ...clean, keys: ['_', 's', 'source', 'p', 'plan', 'help', 'h'] })
    })

    it('accepts --help and -h with no plan, since help needs none', () => {
      // Act & Assert
      assertArgs({ positionals: [], keys: ['_', 'help', 'h'], plan: undefined, help: true })
      assertArgs({ positionals: [], keys: ['_', 'h', 'help'], plan: undefined, help: true })
    })

    it('refuses a bare word, since the plan is named by its flag', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, positionals: ['plan.json'] }), CliError, 'Unexpected argument: "plan.json"')
    })

    it('refuses an unknown flag rather than absorbing it', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, keys: ['_', 'plan', 'p', 'dry', 'help', 'h'] }), CliError, 'Unknown option: "--dry"')
    })

    it('refuses an unknown flag passed beside --help rather than printing help over it', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ positionals: [], keys: ['_', 'bogus', 'help', 'h'], plan: undefined, help: true }), CliError, 'Unknown option: "--bogus"')
    })

    it('refuses a run naming no plan', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ positionals: [], keys: ['_', 'help', 'h'], plan: undefined, help: false }), CliError, 'Missing --plan')
    })

    it('refuses an empty plan value rather than resolving it to the calling directory', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, plan: '' }), CliError, 'Empty --plan value')
    })
  })

  describe('readPlan', () => {
    it('reads a plan of targets', () => {
      // Arrange
      const text = JSON.stringify([{ dir: 'server', cmd: 'deno test src/', source: 'src/a.ts', mutations: [{ name: 'n', before: 'b', after: 'a' }] }])

      // Act
      const plan = readPlan(text, 'plan.json')

      // Assert
      assertEquals(plan, [{ dir: 'server', cmd: 'deno test src/', source: 'src/a.ts', mutations: [{ name: 'n', before: 'b', after: 'a' }] }])
    })

    it('reads a target carrying no mutations, which names a source nothing checks yet', () => {
      // Act
      const plan = readPlan(JSON.stringify([{ dir: 'd', cmd: 'deno test', source: 's', mutations: [] }]), 'plan.json')

      // Assert
      assertEquals(plan, [{ dir: 'd', cmd: 'deno test', source: 's', mutations: [] }])
    })

    it('refuses text that is not JSON, naming the plan file rather than throwing the parser error', () => {
      // Act
      const error = assertThrows(() => readPlan('not json', 'plans/a.json'), CliError)

      // Assert
      assertEquals(error.message, `Plan at plans/a.json is not valid JSON: Unexpected token 'o', "not json" is not valid JSON`)
      assertEquals(error.suggestions, ['Fix the JSON, which holds an array of targets'])
    })

    it('refuses a plan that is not an array', () => {
      // Act & Assert
      assertThrows(() => readPlan('{}', 'plan.json'), CliError, 'Plan must be a json array of targets')
    })

    it('refuses a target missing a field the run reads', () => {
      // Act & Assert: a target with no cmd would run nothing and report every mutation as caught.
      assertThrows(() => readPlan(JSON.stringify([{ dir: 'd', source: 's', mutations: [] }]), 'plan.json'), CliError, 'Plan carries a target the run cannot read')
    })

    it('refuses a mutation missing its anchor', () => {
      // Arrange
      const text = JSON.stringify([{ dir: 'd', cmd: 'deno test', source: 's', mutations: [{ name: 'n', after: 'a' }] }])

      // Act & Assert
      assertThrows(() => readPlan(text, 'plan.json'), CliError, 'Plan carries a target the run cannot read')
    })

    it('refuses an empty anchor, which would prepend the mutation and score a broken file as caught', () => {
      // Arrange
      const text = JSON.stringify([{ dir: 'd', cmd: 'deno test', source: 's', mutations: [{ name: 'n', before: '', after: 'broken ' }] }])

      // Act & Assert
      assertThrows(() => readPlan(text, 'plan.json'), CliError, 'Plan carries a target the run cannot read')
    })

    it('refuses an empty mutation name, which the survivor list would print as nothing', () => {
      // Arrange
      const text = JSON.stringify([{ dir: 'd', cmd: 'deno test', source: 's', mutations: [{ name: '', before: 'b', after: 'a' }] }])

      // Act & Assert
      assertThrows(() => readPlan(text, 'plan.json'), CliError, 'Plan carries a target the run cannot read')
    })

    it('refuses a cmd naming a program other than deno, which the task cannot run once the source is mutated', () => {
      // Act
      const error = assertThrows(() => readPlan(JSON.stringify([{ dir: 'd', cmd: 'npm test', source: 's', mutations: [] }]), 'plan.json'), CliError)

      // Assert
      assertEquals(error.message, 'Target for s runs "npm test", which the tool may not run')
      assertEquals(error.suggestions, ['Start cmd with deno, the only program the task lets the tool run'])
    })

    it('refuses a later target whose cmd the tool cannot run, so no target is mutated before the refusal', () => {
      // Arrange
      const text = JSON.stringify([{ dir: 'd', cmd: 'deno test', source: 'a.ts', mutations: [] }, { dir: 'd', cmd: 'bash test.sh', source: 'b.ts', mutations: [] }])

      // Act & Assert
      assertThrows(() => readPlan(text, 'plan.json'), CliError, 'Target for b.ts runs "bash test.sh", which the tool may not run')
    })

    it('refuses an empty cmd and a program merely starting with deno', () => {
      // Act & Assert
      assertThrows(() => readPlan(JSON.stringify([{ dir: 'd', cmd: '', source: 's', mutations: [] }]), 'plan.json'), CliError, 'Target for s runs "", which the tool may not run')
      assertThrows(() => readPlan(JSON.stringify([{ dir: 'd', cmd: 'denox test', source: 's', mutations: [] }]), 'plan.json'), CliError, 'Target for s runs "denox test"')
    })

    it('refuses a cmd led by a space, since the run splits on single spaces and would name an empty program', () => {
      // Act & Assert
      assertThrows(() => readPlan(JSON.stringify([{ dir: 'd', cmd: ' deno test', source: 's', mutations: [] }]), 'plan.json'), CliError, 'Target for s runs " deno test"')
    })
  })

  describe('applyMutation', () => {
    it('replaces the anchor it was given', () => {
      // Act
      const mutated = applyMutation('if (a) return b', { name: 'n', before: 'if (a)', after: 'if (false)' })

      // Assert
      assertEquals(mutated, 'if (false) return b')
    })

    it('replaces the first anchor only, so one mutation changes one place', () => {
      // Act
      const mutated = applyMutation('x x', { name: 'n', before: 'x', after: 'y' })

      // Assert
      assertEquals(mutated, 'y x')
    })

    it('refuses an anchor the source does not carry', () => {
      // Act & Assert: a typo would otherwise leave the source unchanged and read as a caught mutation.
      assertThrows(() => applyMutation('const a = 1', { name: 'n', before: 'const b', after: 'const c' }), CliError)
    })
  })

  describe('assertAnchors', () => {
    it('accepts a plan whose every anchor occurs in its source', () => {
      // Arrange
      const first = { dir: 'd', cmd: 'deno test', source: 'a.ts', mutations: [{ name: 'guard inverted', before: 'if (a)', after: 'if (!a)' }] }
      const second = { dir: 'd', cmd: 'deno test', source: 'b.ts', mutations: [{ name: 'status changed', before: '200', after: '500' }] }

      // Act & Assert
      assertAnchors([{ target: first, sourcePath: '/p/a.ts', original: 'if (a) run()' }, { target: second, sourcePath: '/p/b.ts', original: 'return 200' }])
    })

    it('refuses an anchor a later target lacks, which would otherwise end the run after earlier verdicts', () => {
      // Arrange
      const first = { dir: 'd', cmd: 'deno test', source: 'a.ts', mutations: [{ name: 'guard inverted', before: 'if (a)', after: 'if (!a)' }] }
      const second = { dir: 'd', cmd: 'deno test', source: 'b.ts', mutations: [{ name: 'status typo', before: '201', after: '500' }] }

      // Act & Assert
      assertThrows(() => assertAnchors([{ target: first, sourcePath: '/p/a.ts', original: 'if (a) run()' }, { target: second, sourcePath: '/p/b.ts', original: 'return 200' }]), CliError, 'Anchor not found for "status typo"')
    })

    it('refuses a later mutation of the same target whose anchor is missing', () => {
      // Arrange
      const target = { dir: 'd', cmd: 'deno test', source: 'a.ts', mutations: [{ name: 'guard inverted', before: 'if (a)', after: 'if (!a)' }, { name: 'call dropped', before: 'runn()', after: '' }] }

      // Act & Assert
      assertThrows(() => assertAnchors([{ target, sourcePath: '/p/a.ts', original: 'if (a) run()' }]), CliError, 'Anchor not found for "call dropped"')
    })
  })

  describe('survivors', () => {
    it('names only the mutations the suite passed on', () => {
      // Act
      const left = survivors([caught('one'), survived('two'), caught('three')])

      // Assert
      assertEquals(left.map((verdict) => verdict.name), ['two'])
    })

    it('names none where every mutation was caught', () => {
      // Act & Assert
      assertEquals(survivors([caught('one')]), [])
    })
  })

  describe('formatVerdict', () => {
    it('marks a caught mutation', () => {
      // Act & Assert
      assertEquals(formatVerdict(caught('one')), '  caught    one')
    })

    it('marks a survivor in caps, since it is what the run is looking for', () => {
      // Act & Assert
      assertEquals(formatVerdict(survived('two')), '  SURVIVED  two')
    })
  })

  describe('formatSummary', () => {
    it('says nothing survived where every mutation was caught', () => {
      // Act
      const summary = formatSummary([caught('one'), caught('two')])

      // Assert
      assertEquals(summary, 'No survivors: all 2 mutations were caught.')
    })

    it('names each survivor and what it means', () => {
      // Act
      const summary = formatSummary([caught('one'), survived('two')])

      // Assert: the count alone reads as a test failure, so the line says what a survivor proves instead.
      assertEquals(summary, '1 of 2 mutations survived, so the tests run these paths without checking them:\n  src/a.ts: two')
    })
  })
})
