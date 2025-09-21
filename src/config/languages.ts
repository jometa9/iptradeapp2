/**
 * Configuración centralizada de idiomas soportados
 * Este archivo es la única fuente de verdad para los idiomas soportados
 */

export const SUPPORTED_LANGUAGES = ['en', 'es', 'ja'] as const;

export const LANGUAGE_CONFIG = {
  en: { name: 'English', flag: '🇺🇸', nativeName: 'English' },
  es: { name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  ja: { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
} as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Verifica si un idioma es soportado
 */
export function isLanguageSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

/**
 * Obtiene información de un idioma
 */
export function getLanguageInfo(language: string) {
  return LANGUAGE_CONFIG[language as SupportedLanguage] || null;
}
