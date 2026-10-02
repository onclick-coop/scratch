import type { ThemeRegistration } from 'shiki/core'

// Shiki Zed parity, from the onclick-coop/scratch repo:
// - `deno task shiki-zed-parity --zed <checkout>` diffs this theme per character against Zed's highlights.scm.
// - `deno task shiki-zed-parity update --zed <checkout> --pinned <checkout>` lists what changed since the commit below.

export const CODE_THEME = 'zed-one-dark'

// Syntax colors from Zed's One Dark theme, keyed by the tree-sitter capture each one styles.
// https://github.com/zed-industries/zed/blob/250b6581b5b346855cccfb909839d47711cf910b/assets/themes/one/one.json
const palette = Object.freeze({
  attribute: '#74ade8',
  boolean: '#bf956a',
  comment: '#5d636f',
  constant: '#dfc184',
  constructor: '#73ade9',
  emphasis: '#74ade8',
  'emphasis.strong': '#bf956a',
  function: '#73ade9',
  keyword: '#b477cf',
  link_text: '#73ade9',
  link_uri: '#6eb4bf',
  number: '#bf956a',
  operator: '#6eb4bf',
  primary: '#acb2be',
  property: '#d07277',
  'punctuation.bracket': '#b2b9c6',
  'punctuation.list_marker': '#d07277',
  'punctuation.markup': '#d07277',
  'punctuation.special': '#b1574b',
  selector: '#dfc184',
  'selector.pseudo': '#74ade8',
  string: '#a1c181',
  'string.escape': '#878e98',
  'string.regex': '#bf956a',
  'string.special': '#bf956a',
  tag: '#74ade8',
  'text.literal': '#a1c181',
  title: '#d07277',
  type: '#6eb4bf',
  variable: '#acb2be',
  'variable.parameter': '#d07277',
  'variable.special': '#bf956a',
})

// Each scope takes the color of the capture Zed's highlights.scm gives that code at this commit.
// https://github.com/zed-industries/zed/tree/250b6581b5b346855cccfb909839d47711cf910b/crates/grammars/src
// Gaps no scope can close sit beside the entry whose color they take.
export const zedOneDark: ThemeRegistration = {
  name: CODE_THEME,
  type: 'dark',
  fg: palette.primary,
  settings: [{
    // `import type` names, bash `export` values, and CSS words like `opacity` keep this color.
    // Shiki scopes each like code Zed colors differently, or not at all, so no selector reaches it.
    settings: { foreground: palette.primary },
  }, {
    // Zed captures neither, so both keep the default color.
    scope: ['storage.modifier.readonly.shell', 'punctuation.terminator.statement.case.shell'],
    settings: { foreground: palette.primary },
  }, {
    scope: ['comment'],
    settings: { foreground: palette.comment },
  }, {
    scope: [
      'keyword',
      'storage',
      'keyword.operator.new',
      'keyword.operator.expression',
      'keyword.operator.logical.and.media',
      'keyword.operator.logical.not.media',
      'keyword.operator.logical.only.media',
      'entity.other.keyframe-offset.css',
      'meta.shebang',
      'punctuation.definition.comment.shebang',
    ],
    settings: { foreground: palette.keyword },
  }, {
    // Bash `-z` in `[[ ]]` shares `&&`'s scope and `:-` shares `#`'s, which Zed colors apart.
    // Bash `>&2` and a case's `*)` are single tokens, where Zed colors their two halves apart.
    scope: ['keyword.operator', 'storage.type.function.arrow', 'punctuation.separator.regex.alternation.shell'],
    settings: { foreground: palette.operator },
  }, {
    scope: [
      'keyword.operator.type',
      'keyword.operator.optional',
      'punctuation.decorator',
      'punctuation.definition.template-expression',
      'punctuation.definition.variable.shell',
      'punctuation.definition.variable.shell variable.other.normal.shell',
      'punctuation.definition.variable.shell variable.parameter.positional.shell',
      'punctuation.definition.variable.shell variable.language.special.shell',
      'punctuation.definition.subshell.single.shell',
      'punctuation.definition.anchor.yaml',
      'punctuation.definition.alias.yaml',
      'entity.other.document',
    ],
    settings: { foreground: palette['punctuation.special'] },
  }, {
    // Quoted and `?` YAML keys take this color, since Shiki scopes them like values.
    scope: ['string', 'punctuation.definition.string'],
    settings: { foreground: palette.string },
  }, {
    scope: ['constant.character.escape'],
    settings: { foreground: palette['string.escape'] },
  }, {
    scope: [
      'string.regexp',
      'string.regexp keyword.control',
      'string.regexp keyword.operator',
      'string.regexp constant',
      'string.regexp punctuation.definition.string',
    ],
    settings: { foreground: palette['string.regex'] },
  }, {
    scope: ['constant.character.entity', 'constant.other.color.rgb-value'],
    settings: { foreground: palette['string.special'] },
  }, {
    scope: ['constant.numeric'],
    settings: { foreground: palette.number },
  }, {
    // JSON shares one scope across true, false, and null, so its booleans take this color.
    scope: ['constant', 'support.constant', 'variable.other.constant', 'variable.parameter.keyframe-list'],
    settings: { foreground: palette.constant },
  }, {
    // YAML `yes` takes this color, where Zed's grammar reads it as a string.
    scope: ['constant.language.boolean'],
    settings: { foreground: palette.boolean },
  }, {
    scope: ['entity.name.function', 'support.function'],
    settings: { foreground: palette.function },
  }, {
    scope: ['meta.method.declaration > storage.type.ts', 'meta.method.declaration > storage.type.tsx'],
    settings: { foreground: palette.constructor },
  }, {
    // A call in a constructor's arguments, as in `new A(b())`, also takes the type color.
    // `void` shares `string`'s scope, and TSX `null` and `undefined` share `object`'s.
    scope: [
      'entity.name.type',
      'entity.other.inherited-class',
      'support.type',
      'support.class',
      'keyword.other.unit',
      'variable.other.alias.yaml',
      'storage.type.tag-handle.yaml',
      'new.expr > meta.function-call > entity.name.function',
    ],
    settings: { foreground: palette.type },
  }, {
    scope: [
      'variable.other.property',
      'variable.other.object.property',
      'variable.object.property',
      'variable.other.enummember',
      'variable.other.constant.property',
      'meta.object-literal.key',
      'support.type.property-name',
      'entity.name.tag.yaml',
      'constant.language.merge.yaml',
    ],
    settings: { foreground: palette.property },
  }, {
    scope: ['variable.parameter'],
    settings: { foreground: palette['variable.parameter'] },
  }, {
    // An ALL-CAPS const keeps this color at its declaration, which shares every const's scope.
    // The `127` in `${1:-127.0.0.1}` shares its parameter's scope, so it misses Zed's string color.
    scope: [
      'meta.template.expression',
      'meta.definition.variable variable.other.constant',
      'entity.name.type.enum',
      'entity.name.type.module',
      'variable.other.normal.shell',
      'variable.parameter.positional.shell',
    ],
    settings: { foreground: palette.variable },
  }, {
    scope: ['variable.language'],
    settings: { foreground: palette['variable.special'] },
  }, {
    scope: [
      'meta.brace',
      'punctuation.accessor',
      'punctuation.definition.block',
      'punctuation.definition.parameters',
      'punctuation.definition.tag',
      'punctuation.section',
      'punctuation.separator',
      'punctuation.terminator',
      'punctuation.definition.typeparameters',
      'punctuation.definition.binding-pattern',
      'punctuation.definition.dictionary',
      'punctuation.definition.array',
      'punctuation.definition.sequence',
      'punctuation.definition.mapping',
      'punctuation.definition.logical-expression',
      'punctuation.definition.arguments.shell',
      'punctuation.definition.entity.css',
      'punctuation.definition.entity.begin.bracket.square.css',
      'punctuation.definition.entity.end.bracket.square.css',
      'meta.tag.attributes > keyword.operator.assignment',
      'keyword.control.flow.block-scalar',
      'keyword.operator.pattern.case.shell',
    ],
    settings: { foreground: palette['punctuation.bracket'] },
  }, {
    // A dotted component such as `Icons.Check` is one token, so its dot takes the tag color.
    scope: ['entity.name.tag', 'support.class.component'],
    settings: { foreground: palette.tag },
  }, {
    scope: ['entity.other.attribute-name'],
    settings: { foreground: palette.attribute },
  }, {
    scope: ['entity.other.attribute-name.class.css', 'entity.other.attribute-name.id.css'],
    settings: { foreground: palette.selector },
  }, {
    scope: ['entity.other.attribute-name.pseudo-class.css', 'entity.other.attribute-name.pseudo-element.css'],
    settings: { foreground: palette['selector.pseudo'] },
  }, {
    scope: ['markup.heading', 'meta.separator.markdown'],
    settings: { foreground: palette.title },
  }, {
    // Zed's bold weight and italic style are left out, since CodeBlock renders only color.
    scope: ['markup.bold'],
    settings: { foreground: palette['emphasis.strong'] },
  }, {
    scope: ['markup.italic'],
    settings: { foreground: palette.emphasis },
  }, {
    scope: ['markup.inline.raw'],
    settings: { foreground: palette['text.literal'] },
  }, {
    scope: [
      'string.other.link',
      'punctuation.definition.link.title',
      'string.other.link.description.title punctuation.definition.string',
    ],
    settings: { foreground: palette.link_text },
  }, {
    scope: ['markup.underline.link', 'punctuation.definition.metadata.markdown', 'punctuation.definition.link.markdown'],
    settings: { foreground: palette.link_uri },
  }, {
    scope: ['punctuation.definition.list'],
    settings: { foreground: palette['punctuation.list_marker'] },
  }, {
    scope: [
      'punctuation.definition.quote.begin.markdown',
      'punctuation.definition.table.markdown',
      'punctuation.separator.table.markdown',
    ],
    settings: { foreground: palette['punctuation.markup'] },
  }],
}
