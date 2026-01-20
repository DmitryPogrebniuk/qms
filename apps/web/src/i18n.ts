import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ukTranslations from './locales/uk.json'
import enTranslations from './locales/en.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'uk',
    defaultNS: 'translation',
    resources: {
      uk: { translation: ukTranslations },
      en: { translation: enTranslations },
    },
  })

export default i18n
