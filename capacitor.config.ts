import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ledgerai.shop',
  appName: 'Ledger AI',
  webDir: 'dist',
  backgroundColor: '#f6b400',
  android: { backgroundColor: '#f6b400' },
  server: { androidScheme: 'https' },
}

export default config
