import { createWindowsInstaller } from '@nodegui/packer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  appDirectory: path.resolve(__dirname, '../dist/win-unpacked'),
  outputDirectory: path.resolve(__dirname, '../release'),
  authors: 'IPTRADE',
  exe: 'IPTRADE.exe',
  name: 'IPTRADE',
  title: 'IPTRADE - Trading Platform',
  description: 'Professional Trading Platform with Copy Trading Capabilities',
  version: '1.2.3',
  iconPath: path.resolve(__dirname, '../public/iconShadow025.png'),
  setupIcon: path.resolve(__dirname, '../public/iconShadow025.png'),
  noMsi: true,
  setupExe: 'IPTRADE-Setup.exe',
  setupLanguages: ['es-ES'],
  nsis: {
    // Permite al usuario elegir el directorio de instalación
    allowToChangeInstallationDirectory: true,
    // Instala para todos los usuarios (requiere admin)
    perMachine: true,
    // Crea acceso directo en el escritorio
    createDesktopShortcut: true,
    // Crea acceso directo en el menú inicio
    createStartMenuShortcut: true,
    // Nombre para los accesos directos
    shortcutName: 'IPTRADE',
    // Elimina datos de la app al desinstalar
    deleteAppDataOnUninstall: true,
    // Mensajes personalizados en español
    messages: {
      welcomePageTitle: 'Instalación de IPTRADE',
      welcomePageDescription: 'Asistente de instalación para la plataforma IPTRADE.',
      installationCompleteTitle: 'Instalación Completada',
      installationCompleteDescription: 'IPTRADE se ha instalado correctamente.',
      installationDirectoryLabel: 'Directorio de instalación:',
      installButtonLabel: 'Instalar',
      cancelButtonLabel: 'Cancelar',
    },
  },
};

async function buildInstaller() {
  try {
    console.log('Creando instalador para Windows...');
    await createWindowsInstaller(config);
    console.log('¡Instalador creado exitosamente!');
    console.log('Ubicación del instalador:', path.join(config.outputDirectory, config.setupExe));
  } catch (error) {
    console.error('Error al crear el instalador:', error);
    process.exit(1);
  }
}

buildInstaller();
