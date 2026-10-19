import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'facturefla-229-tze7ku0c',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_qXsXMh0sm1ndN28Rvusbg4xRfXcWaqDU',
  authRequired: false,
  auth: { mode: 'managed' },
})
