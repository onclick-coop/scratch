import { safe } from '../utils/safe.utils.ts'
import type { TaglineConfig } from './config.ts'
import { type Finding, graphqlBodyMutationPattern, hasTagline } from './parser.ts'
import { apiInputBody } from './payload.ts'

export type ReadFile = (path: string) => string

export type CheckInput = {
  findings: Finding[]
  tagline: string
  readFile: ReadFile
}

export type Violation = {
  subcommand: string
  flag: string
  reason: 'missing-tagline' | 'unreadable-file' | 'stdin-body' | 'runtime-body' | 'graphql-body'
  detail: string
}

const MISSING_HEADLINE = 'Blocked: this gh command writes a GitHub body that is missing the attribution tagline.'
const UNCHECKABLE_HEADLINE = 'Blocked: this gh command writes a GitHub body the hook cannot check.'

const uncheckableReasons: readonly string[] = ['runtime-body', 'graphql-body']

const writtenKinds: readonly string[] = ['written', 'written-json', 'written-graphql']

// Checks the body writes found in a Bash command for text lacking the attribution tagline.
// It returns one violation per offending body argument, and none when the command may run.
export const checkFindings = (input: CheckInput): Violation[] => {
  const { findings, tagline, readFile } = input

  const violations: Violation[] = []

  for (const { subcommand, sources } of findings) {
    for (const source of sources) {
      const { flag } = source
      const add = (reason: Violation['reason'], detail: string): void => {
        violations.push({ subcommand, flag, reason, detail })
      }

      if (source.kind === 'stdin') {
        add('stdin-body', 'the body is piped from stdin, which cannot be verified before the command runs')
        continue
      }

      if (source.kind === 'runtime') {
        add('runtime-body', `the body passed to ${flag} is built at run time, so it cannot be checked`)
        continue
      }

      if (source.kind === 'graphql') {
        add('graphql-body', 'the GraphQL mutation writes a body the hook cannot check reliably')
        continue
      }

      if (source.kind === 'inline') {
        if (hasTagline(source.value, tagline)) continue

        if (source.dynamic) {
          add('runtime-body', `the body passed to ${flag} is built at run time, so it cannot be checked`)
          continue
        }

        add('missing-tagline', `the inline body passed to ${flag} does not end with the tagline`)
        continue
      }

      // A written kind carries the text the script puts in the file, so nothing is read.
      const isWritten = writtenKinds.includes(source.kind)
      const file = isWritten ? `the file the script fills earlier for ${flag}` : `"${source.value}"`
      const inputFile = isWritten ? 'the --input file the script fills earlier' : `the --input file "${source.value}"`
      const { data: contents, error } = safe(() => (isWritten ? source.value : readFile(source.value)))

      if (error) {
        add('unreadable-file', `could not read the body file "${source.value}": ${error.message}`)
        continue
      }

      if (source.kind === 'graphql-file' || source.kind === 'written-graphql') {
        if (graphqlBodyMutationPattern.test(contents)) add('graphql-body', `the GraphQL mutation in ${file} writes a body the hook cannot check reliably`)
        continue
      }

      if (source.kind === 'json-file' || source.kind === 'written-json') {
        const { data: json } = safe((): unknown => JSON.parse(contents))
        const parsed = apiInputBody.safeParse(json)

        if (!parsed.success) {
          add('unreadable-file', `${inputFile} is not a JSON object with a string body`)
          continue
        }

        const { body } = parsed.data
        if (body && !hasTagline(body, tagline)) add('missing-tagline', `the body in ${inputFile} does not end with the tagline`)
        continue
      }

      if (!hasTagline(contents, tagline)) add('missing-tagline', isWritten ? `the body the script writes earlier for ${flag} does not end with the tagline` : `the body file ${file} does not end with the tagline`)
    }
  }

  return violations
}

export const formatViolations = (violations: Violation[], config: TaglineConfig): string => {
  const { text, stale } = config

  const isUncheckable = violations.every((violation) => uncheckableReasons.includes(violation.reason))
  const lines = [isUncheckable ? UNCHECKABLE_HEADLINE : MISSING_HEADLINE, '']

  for (const violation of violations) {
    lines.push(`  - gh ${violation.subcommand}: ${violation.detail}`)
  }

  lines.push('')
  lines.push('Every AI-authored issue body, PR body, and substantive comment must end with:')
  lines.push('')
  lines.push(`    ${text}`)
  lines.push('')
  lines.push('on its own line, separated from the preceding content by a blank line.')
  lines.push('Append it to the body (stripping any stale tagline first), then re-run the command.')

  if (stale.length > 0) {
    lines.push('')
    lines.push('Stale taglines to strip:')
    lines.push('')

    for (const line of stale) {
      lines.push(`    ${line}`)
    }
  }

  const hasStdin = violations.some((violation) => violation.reason === 'stdin-body')

  if (hasStdin) {
    lines.push('')
    lines.push('For stdin-piped bodies: write the body to a file and pass --body-file <path> instead, so the hook can read it before the command runs.')
  }

  const hasRuntime = violations.some((violation) => violation.reason === 'runtime-body')

  if (hasRuntime) {
    lines.push('')
    lines.push('For bodies built at run time: write the body to a file in an earlier step, then pass --body-file <path>, so the hook can read it before the command runs.')
  }

  const hasGraphql = violations.some((violation) => violation.reason === 'graphql-body')

  if (hasGraphql) {
    lines.push('')
    lines.push('For GraphQL mutations: post the body through a REST command instead, such as gh issue comment or gh pr review with --body-file.')
  }

  return lines.join('\n')
}
