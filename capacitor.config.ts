import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.textadventure.game',
  appName: '异界修真指南',
  webDir: 'dist',
  server: {
    url: 'https://www.play-xiuxian.top',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: ['www.play-xiuxian.top', 'play-xiuxian.top'],
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
