import { Globe } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui/button';

/**
 * Botón de cambio de idioma para el navbar
 * Cicla entre los idiomas soportados al hacer clic
 */
export function LanguageToggleButton() {
  const { t, language, setLanguage, supportedLanguages, isLoading } = useTranslation();

  const handleLanguageToggle = () => {
    if (isLoading) return;

    const currentIndex = supportedLanguages.indexOf(language);
    const nextIndex = (currentIndex + 1) % supportedLanguages.length;
    const nextLanguage = supportedLanguages[nextIndex];

    setLanguage(nextLanguage);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-gray-600 hover:text-gray-900"
      title={`${t('language.currentLanguage')}: ${language.toUpperCase()}. ${t('language.clickToChange')}.`}
      onClick={handleLanguageToggle}
      disabled={isLoading}
    >
      <Globe className="w-4 h-4" />
      <span className="ml-1 text-xs font-medium">{language.toUpperCase()}</span>
    </Button>
  );
}
