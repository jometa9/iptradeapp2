import { useTranslation } from '../hooks/useTranslation';

/**
 * Componente selector de idioma
 * Muestra las opciones de idioma disponibles y permite cambiar el idioma actual
 */
export function LanguageSelector() {
  const { language, setLanguage, supportedLanguages, getLanguageName, getLanguageFlag, isLoading } =
    useTranslation();

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span className="text-sm text-gray-600">Cargando idiomas...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Idioma:</span>
      <select
        value={language}
        onChange={e => handleLanguageChange(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={isLoading}
      >
        {supportedLanguages.map(lang => (
          <option key={lang} value={lang}>
            {getLanguageFlag(lang)} {getLanguageName(lang)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Componente de información del idioma actual
 * Muestra información sobre el idioma actual y del sistema
 */
export function LanguageInfo() {
  const { language, systemLanguage, isLoading } = useTranslation();

  if (isLoading) {
    return <div className="text-sm text-gray-500">Cargando información del idioma...</div>;
  }

  return (
    <div className="text-sm text-gray-600">
      <div>
        Idioma actual: <span className="font-medium">{language}</span>
      </div>
      {systemLanguage && systemLanguage !== language && (
        <div>
          Idioma del sistema: <span className="font-medium">{systemLanguage}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Componente de ejemplo que muestra cómo usar las traducciones
 */
export function TranslationExample() {
  const { t } = useTranslation();

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Ejemplo de Traducciones</h3>

      <div className="space-y-2">
        <div>
          <strong>Común:</strong> {t('common.loading')}
        </div>
        <div>
          <strong>Autenticación:</strong> {t('auth.login')}
        </div>
        <div>
          <strong>Dashboard:</strong> {t('dashboard.title')}
        </div>
        <div>
          <strong>Cuentas:</strong> {t('accounts.title')}
        </div>
        <div>
          <strong>Con parámetros:</strong> {t('auth.welcome', { name: 'Usuario' })}
        </div>
      </div>
    </div>
  );
}
