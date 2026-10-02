import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { safeAsync } from '../utils/safe.utils.ts'
import { refusedForKind, toCliError } from './error.ts'
import type { TransformerInput } from './schema.ts'
import { superjsonTransformer } from './transformer.ts'

export type CallProcedureInput = {
  url: string
  transformer: TransformerInput
  headers: Record<string, string>
  procedure: string
  input: unknown
}

// A mutation goes first, and a refusal for its kind retries the call as a query.
export const callProcedure = async (input: CallProcedureInput): Promise<unknown> => {
  const { url, transformer, headers, procedure, input: procedureInput } = input

  // A redirect hands a custom auth header to another origin, as fetch drops only `authorization`.
  const options = {
    url,
    headers,
    fetch: (target: RequestInfo | URL, init?: RequestInit) => fetch(target, { ...init, redirect: 'error' }),
  }

  const link = transformer === 'superjson' ? httpLink({ ...options, transformer: superjsonTransformer }) : httpLink(options)
  const client = createTRPCUntypedClient<AnyTRPCRouter>({ links: [link] })

  const { data: mutated, error: mutationError } = await safeAsync(() => client.mutation(procedure, procedureInput))
  if (!mutationError) return mutated
  if (!refusedForKind(mutationError)) throw toCliError(mutationError, url)

  const { data: queried, error: queryError } = await safeAsync(() => client.query(procedure, procedureInput))
  if (queryError) throw toCliError(queryError, url)

  return queried
}
