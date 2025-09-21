import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

import {
  LANGUAGE_CONFIG,
  SUPPORTED_LANGUAGES,
  getLanguageInfo,
  isLanguageSupported,
} from '../config/languages';
import {
  initializeLanguageDetection,
  startLanguageChangeMonitoring,
} from '../services/electronLanguageService';

// Tipos para i18n
export interface TranslationData {
  [key: string]: string | TranslationData;
}

export interface I18nContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
  supportedLanguages: readonly string[];
  isLanguageSupported: (language: string) => boolean;
  systemLanguage: string | null;
  getLanguageInfo: (language: string) => { name: string; flag: string; nativeName: string } | null;
}

// Crear contexto
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Claves para localStorage
const LANGUAGE_STORAGE_KEY = 'iptrade_app_language';
const USER_LANGUAGE_STORAGE_KEY = 'iptrade_user_selected_language';
const LANGUAGE_CHECK_INTERVAL = 30000; // 30 segundos

// Re-exportar para compatibilidad
export { LANGUAGE_CONFIG, SUPPORTED_LANGUAGES };

// Función para obtener traducciones
async function loadTranslations(language: string): Promise<TranslationData> {
  try {
    const translations = await import(`../locales/${language}.json`);
    return translations.default || translations;
  } catch (error) {
    console.warn(`Failed to load translations for ${language}, falling back to English:`, error);
    try {
      const fallbackTranslations = await import('../locales/en.json');
      return fallbackTranslations.default || fallbackTranslations;
    } catch (fallbackError) {
      console.error('Failed to load fallback translations:', fallbackError);
      return {};
    }
  }
}

// Función para detectar idioma del navegador
function detectBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';

  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  const languageCode = browserLang.split('-')[0].toLowerCase();

  return SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : 'en';
}

// Función para obtener idioma del localStorage
function getStoredLanguage(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to read language from localStorage:', error);
    return null;
  }
}

// Función para obtener idioma seleccionado por el usuario
function getUserSelectedLanguage(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(USER_LANGUAGE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to read user selected language from localStorage:', error);
    return null;
  }
}

// Función para guardar idioma en localStorage
function storeLanguage(language: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to store language in localStorage:', error);
  }
}

// Función para guardar idioma seleccionado por el usuario
function storeUserSelectedLanguage(language: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(USER_LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to store user selected language in localStorage:', error);
  }
}

// Función para verificar si el idioma del navegador cambió
function checkBrowserLanguageChange(currentLanguage: string): boolean {
  if (typeof navigator === 'undefined') return false;

  const browserLang = detectBrowserLanguage();
  return browserLang !== currentLanguage;
}

// Función para obtener valor anidado de un objeto
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Función para reemplazar parámetros en strings
function replaceParams(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key]?.toString() || match;
  });
}

// Props del provider
interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: string;
}

// Provider del contexto
export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const [language, setLanguageState] = useState<string>(() => {
    // Prioridad: prop inicial > idioma seleccionado por usuario > idioma del sistema > navegador > 'en'
    const userSelected = getUserSelectedLanguage();
    const stored = getStoredLanguage();
    const browser = detectBrowserLanguage();

    const finalLanguage = initialLanguage || userSelected || stored || browser || 'en';

    console.log('🌍 Language initialization:', {
      initialLanguage,
      userSelected,
      stored,
      browser,
      finalLanguage,
    });

    return finalLanguage;
  });

  const [translations, setTranslations] = useState<TranslationData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastLanguageCheck, setLastLanguageCheck] = useState(Date.now());
  const [systemLanguage, setSystemLanguage] = useState<string | null>(null);

  // Inicializar detección de idioma del sistema al montar
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        const systemInfo = await initializeLanguageDetection();
        setSystemLanguage(systemInfo.language);

        console.log('🖥️ System language detection:', {
          systemLanguage: systemInfo.language,
          isSupported: systemInfo.isSupported,
          userSelected: getUserSelectedLanguage(),
          stored: getStoredLanguage(),
        });

        // Si no hay idioma seleccionado por el usuario, usar el del sistema
        if (!getUserSelectedLanguage() && !getStoredLanguage() && systemInfo.isSupported) {
          console.log('🔄 No user preference found, using system language:', systemInfo.language);
          setLanguageState(systemInfo.language);
        } else {
          console.log('✅ User has language preference, keeping current language');
        }
      } catch (error) {
        console.error('Error initializing system language detection:', error);
      }
    };

    initializeLanguage();
  }, []);

  // Cargar traducciones cuando cambia el idioma
  useEffect(() => {
    let isMounted = true;

    const loadLanguage = async () => {
      setIsLoading(true);
      try {
        const newTranslations = await loadTranslations(language);
        if (isMounted) {
          setTranslations(newTranslations);
          storeLanguage(language);
          // NO guardar automáticamente como idioma seleccionado por el usuario
          // Solo se debe guardar cuando el usuario explícitamente selecciona un idioma
        }
      } catch (error) {
        console.error('Error loading translations:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadLanguage();

    return () => {
      isMounted = false;
    };
  }, [language]);

  // Verificar cambios de idioma del sistema periódicamente
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const startMonitoring = async () => {
      try {
        cleanup = startLanguageChangeMonitoring(
          language,
          newLanguage => {
            console.log(`System language changed from ${language} to ${newLanguage}`);

            // SOLO cambiar automáticamente si el usuario NO ha seleccionado un idioma
            const userSelectedLanguage = getUserSelectedLanguage();
            if (!userSelectedLanguage) {
              console.log('No user language preference found, updating to system language');
              setLanguageState(newLanguage);
            } else {
              console.log('User has selected language preference, keeping user choice');
            }
          },
          LANGUAGE_CHECK_INTERVAL
        );
      } catch (error) {
        console.error('Error starting language monitoring:', error);
      }
    };

    startMonitoring();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [language]);

  // Función para cambiar idioma
  const setLanguage = (newLanguage: string) => {
    if (SUPPORTED_LANGUAGES.includes(newLanguage)) {
      setLanguageState(newLanguage);
      // Guardar como idioma seleccionado por el usuario
      storeUserSelectedLanguage(newLanguage);
    } else {
      console.warn(`Language ${newLanguage} is not supported`);
    }
  };

  // Función de traducción
  const t = (key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedValue(translations, key);

    if (translation === undefined) {
      console.warn(`Translation key "${key}" not found for language "${language}"`);
      return key; // Retornar la clave si no se encuentra la traducción
    }

    if (typeof translation !== 'string') {
      console.warn(`Translation key "${key}" is not a string for language "${language}"`);
      return key;
    }

    return replaceParams(translation, params);
  };

  // Usar las funciones centralizadas
  const isLanguageSupportedFunc = isLanguageSupported;
  const getLanguageInfoFunc = getLanguageInfo;

  const contextValue: I18nContextType = {
    language,
    setLanguage,
    t,
    isLoading,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isLanguageSupported: isLanguageSupportedFunc,
    systemLanguage,
    getLanguageInfo: getLanguageInfoFunc,
  };

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

// Hook para usar el contexto
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);

  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}

// Hook simplificado para traducciones
export function useTranslation() {
  const { t, language, setLanguage, isLoading, supportedLanguages, isLanguageSupported } =
    useI18n();

  return {
    t,
    language,
    setLanguage,
    isLoading,
    supportedLanguages,
    isLanguageSupported,
  };
}

// Función utilitaria para obtener idioma por defecto
export function getDefaultLanguage(): string {
  return getStoredLanguage() || detectBrowserLanguage() || 'en';
}

// Función utilitaria para limpiar caché de idioma
export function clearLanguageCache(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
      localStorage.removeItem(USER_LANGUAGE_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear language cache:', error);
    }
  }
}
