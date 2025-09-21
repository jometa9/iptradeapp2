/**
 * Configuración centralizada de idiomas para el proceso principal de Electron
 * Este archivo es la única fuente de verdad para los idiomas soportados en el backend
 */

const SUPPORTED_LANGUAGES = ['en', 'es', 'ja'];

const LANGUAGE_CONFIG = {
  en: { name: 'English', flag: '🇺🇸', nativeName: 'English' },
  es: { name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  ja: { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
};

/**
 * Verifica si un idioma es soportado
 */
function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language?.toLowerCase());
}

/**
 * Obtiene información de un idioma
 */
function getLanguageInfo(language) {
  return LANGUAGE_CONFIG[language?.toLowerCase()] || null;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  LANGUAGE_CONFIG,
  isLanguageSupported,
  getLanguageInfo,
};
