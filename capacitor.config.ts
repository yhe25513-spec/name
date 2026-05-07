import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.textadventure.game',
  appName: '异界修真指南',
  webDir: 'dist',
  server: {
    // 部署后改成你的线上地址，API 就能工作了
    // url: 'https://你的项目名.vercel.app',
    // cleartext: true,
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
