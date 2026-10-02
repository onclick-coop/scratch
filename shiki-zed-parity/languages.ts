import { CliError } from '../utils/error.utils.ts'

export const THEME_PATH = 'assets/themes/one/one.json'

export type Language = {
  name: string
  grammar: string
  queries: string
}

// Each name is both a Shiki language id and the stem of the sample under samples/.
export const LANGUAGES: readonly Language[] = [
  { name: 'bash', grammar: 'tree-sitter-bash/tree-sitter-bash.wasm', queries: 'crates/grammars/src/bash/highlights.scm' },
  { name: 'css', grammar: 'tree-sitter-css/tree-sitter-css.wasm', queries: 'crates/grammars/src/css/highlights.scm' },
  { name: 'html', grammar: 'tree-sitter-html/tree-sitter-html.wasm', queries: 'extensions/html/languages/html/highlights.scm' },
  { name: 'json', grammar: 'tree-sitter-json/tree-sitter-json.wasm', queries: 'crates/grammars/src/json/highlights.scm' },
  { name: 'tsx', grammar: 'tree-sitter-typescript/tree-sitter-tsx.wasm', queries: 'crates/grammars/src/tsx/highlights.scm' },
  { name: 'typescript', grammar: 'tree-sitter-typescript/tree-sitter-typescript.wasm', queries: 'crates/grammars/src/typescript/highlights.scm' },
  { name: 'yaml', grammar: '@tree-sitter-grammars/tree-sitter-yaml/tree-sitter-yaml.wasm', queries: 'crates/grammars/src/yaml/highlights.scm' },
]

// Every sample under samples/, including markdown, which Shiki colors without a tree-sitter grammar.
export const SAMPLES: readonly string[] = [...LANGUAGES.map((language) => language.name), 'markdown']

type Unsupported = {
  name: string
  reason: string
}

const UNSUPPORTED: readonly Unsupported[] = [
  { name: 'markdown', reason: 'no wasm build of tree-sitter-markdown is published, and Zed splits it into block and inline grammars' },
  { name: 'sql', reason: 'Zed ships no built-in SQL queries to compare against' },
  { name: 'vue', reason: 'Zed ships no built-in Vue queries to compare against' },
]

// Reads the language argument, where an absent one selects every language the tool compares.
export const selectLanguages = (argument: string | undefined): readonly Language[] => {
  if (argument === undefined) return LANGUAGES

  const known = LANGUAGES.filter((language) => language.name === argument)
  if (known.length) return known

  const names = LANGUAGES.map((language) => language.name).join(', ')

  const [unsupported] = UNSUPPORTED.filter((language) => language.name === argument)
  if (unsupported) throw new CliError(`Cannot compare ${unsupported.name}: ${unsupported.reason}`, [`Compared languages: ${names}`])

  throw new CliError(`Unknown language: "${argument}"`, [`Compared languages: ${names}`, 'Omit the language to compare all of them'])
}
