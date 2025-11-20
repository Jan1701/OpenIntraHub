const fs = require('fs');
const path = require('path');

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

        console.log('🔄 Scanne Module...');

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
                    console.log(`✅ Modul geladen: ${manifest.name} v${manifest.version}`);
                } catch (error) {
                    console.error(`❌ Fehler beim Laden von ${manifest.name}:`, error);
                }
            }
        });
        console.log('🚀 Alle Module verarbeitet.');
    }
}

module.exports = ModuleLoader;
