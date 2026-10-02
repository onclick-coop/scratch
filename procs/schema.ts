import { z } from 'zod'

// https://github.com/pvolok/mprocs#config
export const mprocsConfigInput = z.object({
  procs: z.record(z.string(), z.unknown()),
  server: z.unknown().optional(),
})

export type MprocsConfigInput = z.infer<typeof mprocsConfigInput>

// Checked only by the actions, so an address list and logs never use cannot break them.
export const serverInput = z.string()

// A session names the mprocs config its gprocs runs and the --log-dir it writes to, if any.
export const sessionInput = z.strictObject({
  config: z.string().min(1),
  logDir: z.string().min(1).optional(),
})

export type SessionInput = z.infer<typeof sessionInput>

export const procsConfigInput = z.strictObject({
  sessions: z.record(z.string().min(1), sessionInput).default({}),
  defaultSession: z.string().min(1).optional(),
}).refine((config) => config.defaultSession === undefined || Object.hasOwn(config.sessions, config.defaultSession), {
  message: 'defaultSession names no session in sessions',
  path: ['defaultSession'],
})

export type ProcsConfigInput = z.infer<typeof procsConfigInput>
