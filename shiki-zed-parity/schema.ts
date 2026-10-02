import { z } from 'zod'

// https://github.com/zed-industries/zed/blob/main/crates/theme/src/schema.rs
export const themeFamilyOutput = z.object({
  themes: z.array(z.object({
    name: z.string(),
    style: z.object({
      'editor.foreground': z.string(),
      syntax: z.record(
        z.string(),
        z.object({
          color: z.string().nullish(),
        }),
      ),
    }),
  })),
})

export type ThemeFamilyOutput = z.infer<typeof themeFamilyOutput>

// https://shiki.style/guide/load-theme
export const themeModuleInput = z.object({
  zedOneDark: z.object({
    name: z.string(),
    type: z.enum(['light', 'dark']),
    fg: z.string(),
    settings: z.array(z.object({
      scope: z.union([z.string(), z.array(z.string())]).optional(),
      settings: z.object({
        foreground: z.string().optional(),
      }),
    })),
  }),
})

export type ThemeModuleInput = z.infer<typeof themeModuleInput>

export type ShikiTheme = ThemeModuleInput['zedOneDark']
