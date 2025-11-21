/**
 * OpenIntraHub - Internationalization (i18n) Service
 *
 * Multi-language support system using i18next
 *
 * Features:
 * - Automatic language detection from Accept-Language header
 * - User-specific language preferences
 * - Filesystem-based translation files
 * - Fallback language support
 * - Module translation namespaces
 *
 * @author Jan Günther <jg@linxpress.de>
 * @license Apache-2.0
 */

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');
const logger = require('./logger');

// Unterstützte Sprachen
const SUPPORTED_LANGUAGES = ['de', 'en'];
const DEFAULT_LANGUAGE = 'de';
const FALLBACK_LANGUAGE = 'en';

// i18next initialisieren
i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
        // Backend-Konfiguration für Dateisystem
        backend: {
            loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
            addPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.missing.json')
        },

        // Sprach-Einstellungen
        fallbackLng: FALLBACK_LANGUAGE,
        supportedLngs: SUPPORTED_LANGUAGES,
        preload: SUPPORTED_LANGUAGES,
        defaultNS: 'common',
        ns: ['common', 'auth', 'errors', 'validation'],

        // Spracherkennung
        detection: {
            order: ['querystring', 'cookie', 'header'],
            lookupQuerystring: 'lang',
            lookupCookie: 'i18next',
            lookupHeader: 'accept-language',
            caches: ['cookie'],
            ignoreCase: true,
            cookieSecure: process.env.NODE_ENV === 'production',
            cookieSameSite: 'lax'
        },

        // Entwicklungs-Optionen
        debug: process.env.NODE_ENV === 'development',
        saveMissing: process.env.NODE_ENV === 'development',
        saveMissingTo: 'current',

        // Interpolation
        interpolation: {
            escapeValue: false,
            format: function(value, format, lng) {
                if (format === 'uppercase') return value.toUpperCase();
                if (format === 'lowercase') return value.toLowerCase();
                if (value instanceof Date) {
                    return new Intl.DateTimeFormat(lng).format(value);
                }
                return value;
            }
        },

        // React-Kompatibilität (für zukünftige Frontend-Integration)
        react: {
            useSuspense: false
        }
    }, (err) => {
        if (err) {
            logger.error('i18next Initialisierung fehlgeschlagen', { error: err.message });
        } else {
            logger.info('i18next erfolgreich initialisiert', {
                languages: SUPPORTED_LANGUAGES,
                default: DEFAULT_LANGUAGE
            });
        }
    });

/**
 * Erstellt eine i18n-Instanz für ein spezifisches Modul
 *
 * @param {string} moduleName - Name des Moduls
 * @returns {Object} i18n-Instanz mit Modul-Namespace
 */
function createModuleI18n(moduleName) {
    const moduleNamespace = `module_${moduleName}`;

    // Namespace registrieren falls noch nicht vorhanden
    if (!i18next.options.ns.includes(moduleNamespace)) {
        i18next.options.ns.push(moduleNamespace);
    }

    return {
        t: (key, options = {}) => i18next.t(key, { ...options, ns: moduleNamespace }),
        exists: (key) => i18next.exists(key, { ns: moduleNamespace }),
        language: i18next.language,
        languages: SUPPORTED_LANGUAGES,
        changeLanguage: (lng) => i18next.changeLanguage(lng)
    };
}

/**
 * Übersetzt einen Key mit der Sprache des Requests
 *
 * @param {Object} req - Express Request-Objekt
 * @param {string} key - Übersetzungs-Key
 * @param {Object} options - Übersetzungs-Optionen
 * @returns {string} Übersetzte Nachricht
 */
function translateForRequest(req, key, options = {}) {
    const lng = req.language || DEFAULT_LANGUAGE;
    return i18next.t(key, { ...options, lng });
}

/**
 * Fügt Übersetzungs-Helper zum Request hinzu
 * Express-Middleware für Request-basierte Übersetzungen
 */
function i18nRequestMiddleware(req, res, next) {
    // Übersetzungs-Funktion zum Request hinzufügen
    req.t = (key, options = {}) => translateForRequest(req, key, options);

    // Response-Helper für lokalisierte API-Antworten
    res.localizedJson = (statusCode, messageKey, data = {}, options = {}) => {
        res.status(statusCode).json({
            success: statusCode < 400,
            message: req.t(messageKey, options),
            ...data
        });
    };

    next();
}

/**
 * Validiert und normalisiert Sprach-Code
 *
 * @param {string} lang - Sprach-Code (z.B. 'de', 'en', 'de-DE')
 * @returns {string|null} Normalisierter Sprach-Code oder null
 */
function validateLanguage(lang) {
    if (!lang || typeof lang !== 'string') return null;

    const normalized = lang.toLowerCase().split('-')[0];
    return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : null;
}

module.exports = {
    i18next,
    middleware: middleware.handle(i18next),
    i18nRequestMiddleware,
    createModuleI18n,
    translateForRequest,
    validateLanguage,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    FALLBACK_LANGUAGE
};
