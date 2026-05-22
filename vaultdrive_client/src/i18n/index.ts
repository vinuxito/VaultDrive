import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import local translations
import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';
import enSettings from '../locales/en/settings.json';
import esSettings from '../locales/es/settings.json';
import enAuth from '../locales/en/auth.json';
import esAuth from '../locales/es/auth.json';
import enDrive from '../locales/en/drive.json';
import esDrive from '../locales/es/drive.json';
import enHelp from '../locales/en/help.json';
import esHelp from '../locales/es/help.json';

import abrnEnOverrides from '../locales/overrides/abrn/en.json';
import abrnEsOverrides from '../locales/overrides/abrn/es.json';
import { branding } from '../config/branding';
import { deepMerge } from './merge';

const enResources = {
  common: enCommon,
  settings: enSettings,
  auth: enAuth,
  drive: enDrive,
  help: enHelp,
};

const esResources = {
  common: esCommon,
  settings: esSettings,
  auth: esAuth,
  drive: esDrive,
  help: esHelp,
};

if (branding.productSlug === 'abrn-drive') {
  deepMerge(enResources, abrnEnOverrides);
  deepMerge(esResources, abrnEsOverrides);
}


i18n

  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: enResources,
      es: esResources,
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    ns: ['common', 'settings', 'auth', 'drive', 'help'],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    react: {
      useSuspense: false,
    },
  });

// Keep <html lang="…"> in sync with the active language (a11y requirement).
// Screen readers use this attribute to determine pronunciation and voice.
i18n.on('languageChanged', (lng: string) => {
  document.documentElement.lang = lng;
});
// Set initial lang in case LanguageDetector chose a non-default
document.documentElement.lang = i18n.language || 'en';

export default i18n;
