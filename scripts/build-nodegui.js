import { build } from '@nodegui/packer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildOptions = {
  appPath: path.resolve(__dirname, '..'),
  outPath: path.resolve(__dirname, '../dist'),
  target: 'win32',
  arch: 'x64',
  config: {
    appId: 'com.iptrade.app',
    productName: 'IPTRADE',
    copyright: 'Copyright © 2024 IPTRADE',
    directories: {
      output: 'release',
      buildResources: 'resources',
    },
    files: ['dist/**/*', 'resources/**/*', 'server/**/*', 'package.json'],
    win: {
      icon: 'public/iconShadow025.png',
      target: [
        {
          target: 'nsis',
          arch: ['x64'],
        },
      ],
    },
    nsis: {
      oneClick: false,
      perMachine: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'IPTRADE',
      installerIcon: 'public/iconShadow025.png',
      uninstallerIcon: 'public/iconShadow025.png',
      installerHeaderIcon: 'public/iconShadow025.png',
    },
  },
};

(async () => {
  try {
    console.log('Building Windows application...');
    await build(buildOptions);
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
})();
