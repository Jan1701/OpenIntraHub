# Contributing to OpenIntraHub

Vielen Dank für dein Interesse an OpenIntraHub! 🎉

## 🤝 Wie kann ich beitragen?

### 1. Issues melden
- Nutze [GitHub Issues](https://github.com/Jan1701/OpenIntraHub/issues)
- Beschreibe das Problem detailliert
- Füge Steps to Reproduce hinzu
- Screenshots helfen!

### 2. Feature Requests
- Erstelle ein Issue mit dem Tag "enhancement"
- Erkläre den Use Case
- Warum ist das Feature wichtig?

### 3. Code beitragen

#### Pull Request Prozess:

1. **Fork das Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/OpenIntraHub.git
   cd OpenIntraHub
   ```

2. **Branch erstellen**
   ```bash
   git checkout -b feature/mein-feature
   # oder
   git checkout -b fix/mein-bugfix
   ```

3. **Development Setup**
   ```bash
   npm install
   cp .env.example .env
   # .env anpassen
   npm run db:setup
   npm run dev
   ```

4. **Code schreiben**
   - Folge dem bestehenden Code-Stil
   - Kommentiere komplexe Logik
   - Nutze Winston Logger (kein console.log)

5. **Testen**
   ```bash
   npm test
   node -c core/*.js  # Syntax-Check
   ```

6. **Commit**
   ```bash
   git add .
   git commit -m "Feature: Beschreibung deines Features"
   ```

   **Commit Message Format:**
   - `Feature: ...` - Neues Feature
   - `Fix: ...` - Bugfix
   - `Refactor: ...` - Code-Refactoring
   - `Docs: ...` - Dokumentation
   - `Test: ...` - Tests

7. **Push & Pull Request**
   ```bash
   git push origin feature/mein-feature
   ```
   Dann erstelle einen PR auf GitHub!

## 📋 Code Guidelines

### JavaScript Style
- ES6+ Syntax
- `const` bevorzugen, dann `let`, nie `var`
- Async/Await statt Promises Chaining
- Destructuring verwenden

### Module entwickeln
```javascript
// modules/mein-modul/index.js
module.exports = {
    init: (ctx) => {
        const { router, events, services, middleware, permissions } = ctx;
        const logger = services.logger;

        // Dein Code hier
        router.get('/api/mein-modul/endpoint', (req, res) => {
            logger.info('Endpoint aufgerufen');
            res.json({ success: true });
        });

        logger.info('Mein Modul initialisiert');
    }
};
```

### Logging
```javascript
// ✅ Richtig
logger.info('User erstellt', { userId: user.id, username: user.username });
logger.error('Fehler aufgetreten', { error: error.message });

// ❌ Falsch
console.log('User erstellt');
```

### Error Handling
```javascript
// ✅ Immer try-catch in async Funktionen
async function doSomething() {
    try {
        const result = await database.query('...');
        return result;
    } catch (error) {
        logger.error('Operation fehlgeschlagen', { error: error.message });
        throw error;
    }
}
```

## 🏗️ Architektur

### Core vs. Modules
- **Core:** Infrastruktur (Auth, DB, Logger, etc.)
- **Modules:** Business-Logik (Chat, Wiki, Files, etc.)

**Regel:** Keine Business-Logik im Core!

### Module Context
Jedes Modul bekommt:
```javascript
{
    router,           // Express App
    events,           // Event-Bus
    services: {
        database,     // PostgreSQL
        logger        // Winston Logger
    },
    middleware: {
        authenticateToken,
        requireRole,
        requireAdmin,
        // ...
    },
    permissions: {
        requirePermission,
        hasPermission,
        ROLES,
        PERMISSIONS
    }
}
```

## 📝 Dokumentation

- Code-Kommentare für komplexe Logik
- JSDoc für öffentliche Funktionen
- README für neue Module
- API-Dokumentation via Swagger

## 🧪 Testing (Coming Soon)

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests
npm run test:int      # Integration tests
```

## 🐛 Debugging

```bash
# Debug-Modus
LOG_LEVEL=debug npm run dev

# Nur bestimmtes Modul debuggen
# In Code: logger.debug('Debug info', { data })
```

## 📞 Fragen?

- Email: jg@linxpress.de
- GitHub Issues: https://github.com/Jan1701/OpenIntraHub/issues
- GitHub Discussions: https://github.com/Jan1701/OpenIntraHub/discussions

## 📜 Lizenz

Indem du zu OpenIntraHub beiträgst, stimmst du zu, dass deine Beiträge unter der Apache 2.0 Lizenz lizenziert werden.

---

**Danke für deinen Beitrag! 🙏**
