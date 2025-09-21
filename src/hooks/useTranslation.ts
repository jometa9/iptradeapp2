import { useI18n } from '../context/I18nContext';

/**
 * Hook simplificado para usar traducciones en componentes
 * Proporciona acceso directo a la función de traducción y estado del idioma
 */
export function useTranslation() {
  const {
    t,
    language,
    setLanguage,
    isLoading,
    supportedLanguages,
    isLanguageSupported,
    getLanguageInfo,
  } = useI18n();

  return {
    /**
     * Función para traducir claves
     * @param key - Clave de traducción (ej: 'common.loading')
     * @param params - Parámetros para reemplazar en la traducción
     * @returns Texto traducido
     */
    t,

    /**
     * Idioma actual
     */
    language,

    /**
     * Cambiar idioma
     * @param newLanguage - Nuevo idioma (ej: 'es', 'en')
     */
    setLanguage,

    /**
     * Estado de carga de traducciones
     */
    isLoading,

    /**
     * Lista de idiomas soportados
     */
    supportedLanguages,

    /**
     * Verificar si un idioma es soportado
     * @param lang - Idioma a verificar
     * @returns true si es soportado
     */
    isLanguageSupported,

    /**
     * Obtener información completa de un idioma
     * @param lang - Código del idioma
     * @returns Información del idioma (nombre, bandera, nombre nativo)
     */
    getLanguageInfo,

    /**
     * Obtener nombre del idioma en su idioma nativo
     * @param lang - Código del idioma
     * @returns Nombre del idioma
     */
    getLanguageName: (lang: string) => {
      const info = getLanguageInfo(lang);
      return info?.nativeName || lang;
    },
  };
}

/**
 * Hook para obtener solo la función de traducción
 * Útil cuando solo necesitas traducir texto sin cambiar idioma
 */
export function useT() {
  const { t } = useI18n();
  return t;
}

/**
 * Hook para obtener información del idioma actual
 */
export function useLanguage() {
  const { language, setLanguage, supportedLanguages, isLanguageSupported } = useI18n();

  return {
    language,
    setLanguage,
    supportedLanguages,
    isLanguageSupported,
  };
}
