import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import './Header.css';

export const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };
  
  return (
    <header className="app-header">
      <h1>{t('app.title')}</h1>
      
      <button className="language-toggle" onClick={toggleLanguage} title="Language / Idioma">
        <Globe size={18} />
        <span>{i18n.language.toUpperCase()}</span>
      </button>
    </header>
  );
};
