import type { Browser, BrowserContext, Page } from 'playwright'
import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'

export type DriverInput = {
  browser: Browser
  context: BrowserContext
  page: Page
}

export type Driver = (input: DriverInput) => Promise<void> | void

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import
export const driverModuleInput = z.looseObject({
  default: z.custom<Driver>((value) => typeof value === 'function'),
})

// Picks the function a driver module exports as default, refusing a module that exports none.
export const toDriver = (module: unknown, path: string): Driver => {
  const parsed = driverModuleInput.safeParse(module)
  if (!parsed.success) throw new CliError(`The driver at ${path} must export a default function`, ['Export default async ({ browser, context, page }) => { ... }'])

  return parsed.data.default
}
