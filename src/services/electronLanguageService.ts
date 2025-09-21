import { SUPPORTED_LANGUAGES } from '../config/languages';

/**
 * Servicio para integrar la detección de idioma del OS con Electron
 * Utiliza los handlers IPC para comunicarse con el proceso principal
 */

export interface SystemLanguageInfo {
  language: string;
  country: string;
  locale: string;
  isSupported: boolean;
  originalLocale: string;
}

export interface ElectronLanguageService {
  detectSystemLanguage(): Promise<SystemLanguageInfo>;
  getSupportedLanguages(): Promise<string[]>;
  isLanguageSupported(language: string): Promise<boolean>;
}

class ElectronLanguageServiceImpl implements ElectronLanguageService {
  private cachedSystemLanguage: SystemLanguageInfo | null = null;
  private lastDetectionTime: number = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000;

  /**
   * Detecta el idioma del sistema operativo usando Electron IPC
   */
  async detectSystemLanguage(): Promise<SystemLanguageInfo> {
    const now = Date.now();

    // Usar caché si no es muy antiguo
    if (this.cachedSystemLanguage && now - this.lastDetectionTime < this.CACHE_DURATION) {
      return this.cachedSystemLanguage;
    }

    try {
      // Verificar si estamos en un entorno Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.detectSystemLanguage();
        this.cachedSystemLanguage = result;
        this.lastDetectionTime = now;
        return result;
      } else {
        // Fallback para navegador
        return this.getBrowserLanguage();
      }
    } catch (error) {
      console.error('Error detecting system language via Electron:', error);
      return this.getBrowserLanguage();
    }
  }

  /**
   * Obtiene la lista de idiomas soportados
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        return await (window as any).electronAPI.getSupportedLanguages();
      } else {
        return ['en', 'es', 'ja'];
      }
    } catch (error) {
      console.error('Error getting supported languages:', error);
      return ['en', 'es', 'ja'];
    }
  }

  /**
   * Verifica si un idioma es soportado
   */
  async isLanguageSupported(language: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        return await (window as any).electronAPI.isLanguageSupported(language);
      } else {
        return SUPPORTED_LANGUAGES.includes(language.toLowerCase());
      }
    } catch (error) {
      console.error('Error checking language support:', error);
      return false;
    }
  }

  /**
   * Fallback para detectar idioma del navegador
   */
  private getBrowserLanguage(): SystemLanguageInfo {
    if (typeof navigator === 'undefined') {
      return {
        language: 'en',
        country: 'US',
        locale: 'en-US',
        isSupported: true,
        originalLocale: 'en-US',
      };
    }

    const browserLang = navigator.language || navigator.languages?.[0] || 'en';
    const languageCode = browserLang.split('-')[0].toLowerCase();
    const countryCode = browserLang.split('-')[1]?.toUpperCase() || 'US';

    const isSupported = SUPPORTED_LANGUAGES.includes(languageCode);

    return {
      language: isSupported ? languageCode : 'en',
      country: isSupported ? countryCode : 'US',
      locale: isSupported ? browserLang : 'en-US',
      isSupported: isSupported,
      originalLocale: browserLang,
    };
  }

  /**
   * Limpia la caché de detección de idioma
   */
  clearCache(): void {
    this.cachedSystemLanguage = null;
    this.lastDetectionTime = 0;
  }

  /**
   * Verifica si el idioma del sistema cambió
   */
  async checkLanguageChange(currentLanguage: string): Promise<boolean> {
    try {
      const systemInfo = await this.detectSystemLanguage();
      return systemInfo.language !== currentLanguage;
    } catch (error) {
      console.error('Error checking language change:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const electronLanguageService = new ElectronLanguageServiceImpl();

// Función utilitaria para inicializar la detección de idioma
export async function initializeLanguageDetection(): Promise<SystemLanguageInfo> {
  try {
    const systemInfo = await electronLanguageService.detectSystemLanguage();
    console.log('System language detected:', systemInfo);
    return systemInfo;
  } catch (error) {
    console.error('Error initializing language detection:', error);
    return {
      language: 'en',
      country: 'US',
      locale: 'en-US',
      isSupported: true,
      originalLocale: 'en-US',
    };
  }
}

// Función para verificar cambios de idioma periódicamente
export function startLanguageChangeMonitoring(
  currentLanguage: string,
  onLanguageChange: (newLanguage: string) => void,
  interval: number = 30000
): () => void {
  const checkInterval = setInterval(async () => {
    try {
      const hasChanged = await electronLanguageService.checkLanguageChange(currentLanguage);
      if (hasChanged) {
        const systemInfo = await electronLanguageService.detectSystemLanguage();
        onLanguageChange(systemInfo.language);
      }
    } catch (error) {
      console.error('Error monitoring language changes:', error);
    }
  }, interval);

  // Retornar función para limpiar el intervalo
  return () => clearInterval(checkInterval);
}
