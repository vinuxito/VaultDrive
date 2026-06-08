import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import abrnEnOverrides from '../locales/overrides/abrn/en.json';
import abrnEsOverrides from '../locales/overrides/abrn/es.json';
import { branding } from '../config/branding';
import { deepMerge } from './merge';

const dynamicLocales: Record<string, Record<string, () => Promise<any>>> = {
  en: {
    common: () => import('../locales/en/common.json'),
    settings: () => import('../locales/en/settings.json'),
    auth: () => import('../locales/en/auth.json'),
    drive: () => import('../locales/en/drive.json'),
    help: () => import('../locales/en/help.json'),
  },
  es: {
    common: () => import('../locales/es/common.json'),
    settings: () => import('../locales/es/settings.json'),
    auth: () => import('../locales/es/auth.json'),
    drive: () => import('../locales/es/drive.json'),
    help: () => import('../locales/es/help.json'),
  }
};

const dynamicLoaderBackend = {
  type: 'backend' as const,
  init() {},
  read(language: string, namespace: string, callback: (err: any, data: any) => void) {
    const load = dynamicLocales[language]?.[namespace];
    if (!load) {
      callback(new Error(`Locale namespace not found: ${language}/${namespace}`), null);
      return;
    }
    load()
      .then((module) => {
        const resources = { ...module.default };
        
        // Merge branding overrides if ABRN Drive
        if (branding.productSlug === 'abrn-drive') {
          if (language === 'en') {
            const override = (abrnEnOverrides as any)[namespace];
            if (override) {
              deepMerge(resources, override);
            }
          } else if (language === 'es') {
            const override = (abrnEsOverrides as any)[namespace];
            if (override) {
              deepMerge(resources, override);
            }
          }
        }
        
        callback(null, resources);
      })
      .catch((err) => {
        callback(err, null);
      });
  }
};

i18n
  .use(dynamicLoaderBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    ns: ['common', 'settings', 'auth', 'drive', 'help'],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    react: {
      useSuspense: true, // Suspend rendering while namespace is loading
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
