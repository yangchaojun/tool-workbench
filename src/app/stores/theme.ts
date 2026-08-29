import { defineStore } from 'pinia'
import { z } from 'zod'

import { loadZodJson, saveZodJson } from '@/shared/storage/zodStorage'

const themeSchema = z.object({ dark: z.boolean().default(false) })

export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: loadZodJson('tw:theme', themeSchema, { dark: false }).dark,
  }),
  actions: {
    toggle() {
      this.dark = !this.dark
      saveZodJson('tw:theme', { dark: this.dark })
    },
  },
})
