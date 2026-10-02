import { z } from 'zod'

// The two schemes a tRPC handler answers on, so `localhost:3002` is not read as a scheme.
export const httpProtocolPattern = /^https?$/

export const serverUrlInput = z.url({ protocol: httpProtocolPattern })

// https://trpc.io/docs/server/data-transformers
export const transformerInput = z.enum(['none', 'superjson'])

export type TransformerInput = z.infer<typeof transformerInput>

// The header a token rides in and the text before it, which is `Bearer ` for most servers.
export const authInput = z.strictObject({
  header: z.string().min(1).default('authorization'),
  prefix: z.string().default('Bearer '),
})

// The procedures that answer with a token, and the dotted path to it inside their result.
export const sessionInput = z.strictObject({
  procedures: z.array(z.string().min(1)).min(1),
  tokenPath: z.string().min(1),
})

export const trpcConfigInput = z.strictObject({
  url: serverUrlInput.optional(),
  transformer: transformerInput.default('none'),
  auth: authInput.default({ header: 'authorization', prefix: 'Bearer ' }),
  session: sessionInput.optional(),
})

export type TrpcConfigInput = z.infer<typeof trpcConfigInput>

// The saved tokens, keyed by the url each was issued for.
export const sessionsFileInput = z.record(z.string(), z.strictObject({ token: z.string().min(1) }))

export type SessionsFileInput = z.infer<typeof sessionsFileInput>

// One level of a procedure's result, which a token path steps through by key.
export const resultObjectInput = z.record(z.string(), z.unknown())
