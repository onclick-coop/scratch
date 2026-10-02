import { createRequire } from 'node:module'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import bash from 'shiki/langs/bash.mjs'
import css from 'shiki/langs/css.mjs'
import html from 'shiki/langs/html.mjs'
import json from 'shiki/langs/json.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import sql from 'shiki/langs/sql.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import vue from 'shiki/langs/vue.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import { Language as Grammar, Parser, Query } from 'web-tree-sitter'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'
import { type Piece, toPieces } from './diff.ts'
import type { Language } from './languages.ts'
import { collectScopes, type ThemeRule, toCharacters } from './redundant.ts'
import type { ShikiTheme } from './schema.ts'
import { type CharacterColor, colorCharacters, type SyntaxTheme } from './zed.ts'

// Every grammar the theme colors code with, with the grammars each one embeds.
const GRAMMARS = [bash, css, html, json, markdown, sql, tsx, typescript, vue, yaml]

export type ZedInput = {
  language: Language
  code: string
  queries: string
  syntax: SyntaxTheme
}

export type ThemeVariant = {
  name: string
  fg: string
  rules: ThemeRule[]
}

export type ShikiRun = {
  variant: ThemeVariant
  language: string
  code: string
}

export type Colorers = {
  zed: (input: ZedInput) => Promise<CharacterColor[]>
  shiki: (language: Language, code: string) => Piece[]
  characters: (run: ShikiRun) => string[]
}

// Lists every scope a grammar the theme colors is able to emit.
export const grammarScopes = (): Set<string> => collectScopes(GRAMMARS)

// Loads tree-sitter and a Shiki highlighter carrying the theme.
export const createColorers = async (theme: ShikiTheme): Promise<Colorers> => {
  await Parser.init()

  const highlighter = await createHighlighterCore({
    themes: [theme],
    langs: [bash, css, html, json, markdown, tsx, typescript, yaml],
    engine: createJavaScriptRegexEngine(),
  })

  // The grammars ship as wasm files inside npm packages, which only a require resolves to a path.
  const require = createRequire(import.meta.url)

  const zed = async (input: ZedInput): Promise<CharacterColor[]> => {
    const { language, code, queries, syntax } = input

    const grammar = await Grammar.load(require.resolve(language.grammar))
    const parser = new Parser()
    parser.setLanguage(grammar)

    const tree = parser.parse(code)
    if (!tree) throw new CliError(`tree-sitter could not parse the ${language.name} sample`)

    const { data: query, error } = safe(() => new Query(grammar, queries))
    if (error) {
      throw new CliError(`Zed's ${language.name} queries do not compile against the pinned grammar: ${error.message}`, [
        'Raise the grammar package in shiki-zed-parity/deno.json to the version Zed pins in its Cargo.toml',
      ])
    }

    const captures = query.captures(tree.rootNode).map((capture) => ({ name: capture.name, start: capture.node.startIndex, end: capture.node.endIndex }))
    return colorCharacters({ length: code.length, captures, theme: syntax })
  }

  const shiki = (language: Language, code: string): Piece[] => {
    return toPieces(highlighter.codeToTokens(code, { lang: language.name, theme: theme.name, includeExplanation: true }).tokens)
  }

  const characters = (run: ShikiRun): string[] => {
    const { variant, language, code } = run

    if (!highlighter.getLoadedThemes().includes(variant.name)) highlighter.loadThemeSync({ ...theme, name: variant.name, fg: variant.fg, settings: variant.rules })

    return toCharacters(highlighter.codeToTokens(code, { lang: language, theme: variant.name }).tokens, code.length)
  }

  return { zed, shiki, characters }
}
