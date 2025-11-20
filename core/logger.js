const winston = require('winston');
const path = require('path');

// Log-Level basierend auf Umgebung
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Log-Format definieren
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console-Format (lesbarer für Development)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
        const moduleStr = module ? `[${module}]` : '';
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} ${level} ${moduleStr} ${message} ${metaStr}`;
    })
);

// Transports definieren
const transports = [
    // Console Output
    new winston.transports.Console({
        format: consoleFormat,
        level: logLevel
    })
];

// File Transports nur in Production oder wenn LOG_TO_FILE=true
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
    const logsDir = path.join(__dirname, '../logs');

    // Error Log
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    );

    // Combined Log
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: logFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    );

    // Access Log (für HTTP-Requests)
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'access.log'),
            level: 'http',
            format: logFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 3
        })
    );
}

// Logger erstellen
const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports,
    exitOnError: false
});

// Hilfsfunktionen für verschiedene Module
const createModuleLogger = (moduleName) => {
    return {
        error: (message, meta = {}) => logger.error(message, { module: moduleName, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { module: moduleName, ...meta }),
        info: (message, meta = {}) => logger.info(message, { module: moduleName, ...meta }),
        http: (message, meta = {}) => logger.http(message, { module: moduleName, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { module: moduleName, ...meta })
    };
};

// Express Morgan Stream für HTTP-Logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

// Uncaught Exception Handler
if (process.env.NODE_ENV === 'production') {
    logger.exceptions.handle(
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log')
        })
    );

    logger.rejections.handle(
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log')
        })
    );
}

module.exports = logger;
module.exports.createModuleLogger = createModuleLogger;
