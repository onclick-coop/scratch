import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'

// An absent file reads as an empty list, so the first add creates it.
export const load = (path: string): string => {
  const { data, error } = safe(() => Deno.readTextFileSync(path))
  if (!error) return data

  // A link whose target is missing would otherwise be replaced by a plain file on the first write.
  if (error instanceof Deno.errors.NotFound) {
    const { data: target, error: linkError } = safe(() => Deno.readLinkSync(path))
    if (linkError) return ''

    throw new CliError(`${path} is a symlink to ${target}, which does not exist`, ['Create its target, or remove the link'])
  }

  throw new CliError(`Failed to read ${path}: ${error.message}`, ['Set file under todo in tools.config.json to a readable file'])
}

// Writes a temp file beside the list and renames it over, so a failed save leaves the old list.
export const save = (path: string, raw: string): void => {
  // A symlinked list is written to the file it points at, not replaced by a plain file.
  const { data: realPath, error: realPathError } = safe(() => Deno.realPathSync(path))
  const target = realPathError ? path : realPath
  const temp = `${target}.${crypto.randomUUID()}.tmp`
  const { data: info, error: statError } = safe(() => Deno.statSync(target))

  // The rename would replace a read-only file anyway, so the file's write permission is checked.
  if (!statError) {
    const { error: openError } = safe(() => Deno.openSync(target, { write: true }).close())
    if (openError) throw new CliError(`${target} is not writable: ${openError.message}`, ['Make it writable first'])
  }

  const writeThroughTemp = (): void => {
    Deno.writeTextFileSync(temp, raw, { createNew: true })

    // The rename carries the temp file's mode over, so it takes the old file's mode first.
    if (!statError && info.mode !== null) Deno.chmodSync(temp, info.mode & 0o777)

    Deno.renameSync(temp, target)
  }

  const { error } = safe(writeThroughTemp)
  if (!error) return

  const { error: removeError } = safe(() => Deno.removeSync(temp))
  const isTempGone = !removeError || removeError instanceof Deno.errors.NotFound
  const suggestions = isTempGone ? [] : [`Remove the leftover ${temp}`]

  throw new CliError(`Failed to write ${target}: ${error.message}`, suggestions)
}
