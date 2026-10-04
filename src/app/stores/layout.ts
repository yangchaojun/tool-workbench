import { defineStore } from 'pinia'
import { z } from 'zod'

import { loadZodJson, saveZodJson } from '@/shared/storage/zodStorage'

const layoutSchema = z.object({ collapsed: z.boolean().default(false) })

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    collapsed: loadZodJson('tw:layout', layoutSchema, { collapsed: false }).collapsed,
  }),
  actions: {
    toggle() {
      this.collapsed = !this.collapsed
      saveZodJson('tw:layout', { collapsed: this.collapsed })
    },
  },
})
