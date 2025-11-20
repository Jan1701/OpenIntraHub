const fs = require('fs');
const path = require('path');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('ModuleLoader');

class ModuleLoader {
    constructor(app, eventBus) {
        this.app = app;
        this.eventBus = eventBus;
        this.modules = new Map();
    }

    loadModules() {
        const modulesPath = path.join(__dirname, '../modules');

        // Falls Ordner nicht existiert, erstellen
        if (!fs.existsSync(modulesPath)) return;

        const folders = fs.readdirSync(modulesPath);

        logger.info('Scanne Module...');

        folders.forEach(folder => {
            const modulePath = path.join(modulesPath, folder);
            const manifestPath = path.join(modulePath, 'manifest.json');

            if (fs.existsSync(manifestPath)) {
                const manifest = require(manifestPath);
                const entryPoint = require(path.join(modulePath, manifest.entry));

                // Modul initialisieren
                try {
                    entryPoint.init({
                        router: this.app,
                        events: this.eventBus,
                        config: manifest.config || {}
                    });

                    this.modules.set(manifest.name, manifest);
                    logger.info('Modul geladen', { name: manifest.name, version: manifest.version });
                } catch (error) {
                    logger.error('Fehler beim Laden eines Moduls', { name: manifest.name, error: error.message });
                }
            }
        });
        logger.info('Alle Module verarbeitet', { count: this.modules.size });
    }
}

module.exports = ModuleLoader;
