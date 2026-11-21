import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ledgerai.shop',
  appName: 'Ledger AI',
  webDir: 'dist',
  backgroundColor: '#14355c',
  android: { backgroundColor: '#14355c' },
  server: { androidScheme: 'https' },
}

export default config
