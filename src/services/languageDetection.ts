import { SUPPORTED_LANGUAGES } from '../config/languages';

/**
 * Servicio para detectar el idioma del sistema operativo
 * Compatible con Windows, macOS y Linux
 */

export interface LanguageDetectionResult {
  language: string;
  country: string;
  locale: string;
  isSupported: boolean;
}

export class LanguageDetectionService {
  private static instance: LanguageDetectionService;
  private cachedResult: LanguageDetectionResult | null = null;
  private lastCheckTime: number = 0;
  private readonly CHECK_INTERVAL = 30000; // 30 segundos

  private constructor() {}

  public static getInstance(): LanguageDetectionService {
    if (!LanguageDetectionService.instance) {
      LanguageDetectionService.instance = new LanguageDetectionService();
    }
    return LanguageDetectionService.instance;
  }

  /**
   * Detecta el idioma del sistema operativo
   * @param forceRefresh - Fuerza la detección sin usar caché
   * @returns Promise<LanguageDetectionResult>
   */
  public async detectSystemLanguage(
    forceRefresh: boolean = false
  ): Promise<LanguageDetectionResult> {
    const now = Date.now();

    // Usar caché si no es muy antiguo y no se fuerza refresh
    if (!forceRefresh && this.cachedResult && now - this.lastCheckTime < this.CHECK_INTERVAL) {
      return this.cachedResult;
    }

    try {
      const result = await this.performLanguageDetection();
      this.cachedResult = result;
      this.lastCheckTime = now;
      return result;
    } catch (error) {
      console.error('Error detecting system language:', error);
      // Retornar fallback en caso de error
      return {
        language: 'en',
        country: 'US',
        locale: 'en-US',
        isSupported: true,
      };
    }
  }

  /**
   * Realiza la detección de idioma del sistema
   */
  private async performLanguageDetection(): Promise<LanguageDetectionResult> {
    const platform = process.platform;
    let systemLocale: string;

    try {
      switch (platform) {
        case 'win32':
          systemLocale = await this.detectWindowsLanguage();
          break;
        case 'darwin':
          systemLocale = await this.detectMacOSLanguage();
          break;
        case 'linux':
          systemLocale = await this.detectLinuxLanguage();
          break;
        default:
          systemLocale = 'en-US';
      }
    } catch (error) {
      console.warn('Error detecting OS language, using fallback:', error);
      systemLocale = 'en-US';
    }

    return this.parseLocale(systemLocale);
  }

  /**
   * Detecta el idioma en Windows
   */
  private async detectWindowsLanguage(): Promise<string> {
    try {
      // Método 1: Usar variables de entorno
      const langEnv = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE;
      if (langEnv) {
        return langEnv;
      }

      // Método 2: Usar PowerShell para obtener el idioma del sistema
      const { spawn } = require('child_process');
      return new Promise((resolve, reject) => {
        const powershell = spawn('powershell', [
          '-Command',
          'Get-Culture | Select-Object -ExpandProperty Name',
        ]);

        let output = '';
        powershell.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        powershell.on('close', (code: number) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            resolve('en-US');
          }
        });

        powershell.on('error', () => {
          resolve('en-US');
        });
      });
    } catch (error) {
      return 'en-US';
    }
  }

  /**
   * Detecta el idioma en macOS
   */
  private async detectMacOSLanguage(): Promise<string> {
    try {
      // Método 1: Usar variables de entorno
      const langEnv = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE;
      if (langEnv) {
        return langEnv;
      }

      // Método 2: Usar defaults para obtener el idioma del sistema
      const { spawn } = require('child_process');
      return new Promise((resolve, reject) => {
        const defaults = spawn('defaults', ['read', '-g', 'AppleLocale']);

        let output = '';
        defaults.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        defaults.on('close', (code: number) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            resolve('en_US');
          }
        });

        defaults.on('error', () => {
          resolve('en_US');
        });
      });
    } catch (error) {
      return 'en_US';
    }
  }

  /**
   * Detecta el idioma en Linux
   */
  private async detectLinuxLanguage(): Promise<string> {
    try {
      // Método 1: Usar variables de entorno
      const langEnv = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE;
      if (langEnv) {
        return langEnv;
      }

      // Método 2: Usar locale command
      const { spawn } = require('child_process');
      return new Promise((resolve, reject) => {
        const locale = spawn('locale', ['-a']);

        let output = '';
        locale.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        locale.on('close', (code: number) => {
          if (code === 0 && output.trim()) {
            // Buscar el primer locale que contenga UTF-8
            const locales = output.split('\n').filter(line => line.includes('UTF-8'));
            if (locales.length > 0) {
              resolve(locales[0]);
            } else {
              resolve('en_US.UTF-8');
            }
          } else {
            resolve('en_US.UTF-8');
          }
        });

        locale.on('error', () => {
          resolve('en_US.UTF-8');
        });
      });
    } catch (error) {
      return 'en_US.UTF-8';
    }
  }

  /**
   * Parsea el locale del sistema y determina si es soportado
   */
  private parseLocale(locale: string): LanguageDetectionResult {
    // Normalizar el locale
    const normalizedLocale = locale.replace(/[._]/g, '-');

    // Extraer idioma y país
    const parts = normalizedLocale.split('-');
    const language = parts[0]?.toLowerCase() || 'en';
    const country = parts[1]?.toUpperCase() || 'US';

    // Determinar si el idioma es soportado
    const isSupported = SUPPORTED_LANGUAGES.includes(language);

    // Si no es soportado, usar inglés como fallback
    const finalLanguage = isSupported ? language : 'en';
    const finalCountry = isSupported ? country : 'US';
    const finalLocale = `${finalLanguage}-${finalCountry}`;

    return {
      language: finalLanguage,
      country: finalCountry,
      locale: finalLocale,
      isSupported: isSupported,
    };
  }

  /**
   * Obtiene la lista de idiomas soportados
   */
  public getSupportedLanguages(): string[] {
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
  }

  /**
   * Verifica si un idioma es soportado
   */
  public isLanguageSupported(language: string): boolean {
    return this.getSupportedLanguages().includes(language.toLowerCase());
  }

  /**
   * Limpia la caché
   */
  public clearCache(): void {
    this.cachedResult = null;
    this.lastCheckTime = 0;
  }
}

// Exportar instancia singleton
export const languageDetectionService = LanguageDetectionService.getInstance();
