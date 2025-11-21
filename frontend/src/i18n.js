import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          pageBuilder: {
            title: 'Page Builder',
            pages: 'Pages',
            createPage: 'Create Page',
            editPage: 'Edit Page',
            deletePage: 'Delete Page',
            modules: 'Modules',
            sections: 'Sections',
            addSection: 'Add Section',
            addModule: 'Add Module',
            settings: 'Settings',
            preview: 'Preview',
            publish: 'Publish',
            save: 'Save',
            cancel: 'Cancel',
            dragModule: 'Drag modules here'
          }
        }
      },
      de: {
        translation: {
          pageBuilder: {
            title: 'Seiten-Builder',
            pages: 'Seiten',
            createPage: 'Seite erstellen',
            editPage: 'Seite bearbeiten',
            deletePage: 'Seite löschen',
            modules: 'Module',
            sections: 'Abschnitte',
            addSection: 'Abschnitt hinzufügen',
            addModule: 'Modul hinzufügen',
            settings: 'Einstellungen',
            preview: 'Vorschau',
            publish: 'Veröffentlichen',
            save: 'Speichern',
            cancel: 'Abbrechen',
            dragModule: 'Module hier hinziehen'
          }
        }
      }
    },
    lng: 'de',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
