# OpenIntraHub

<div align="center">

![OpenIntraHub Logo](logo/transparent.png)

**Moderne, modulare Social-Intranet-Plattform**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![GitHub Issues](https://img.shields.io/github/issues/Jan1701/OpenIntraHub)](https://github.com/Jan1701/OpenIntraHub/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 🚀 Features

### ✨ **Core-System**
- 🔐 **Multi-Authentifizierung** (JWT, LDAP, Database)
- 👥 **RBAC** - 5 Rollen, 20+ Permissions
- 🌍 **i18n** - Mehrsprachigkeit (DE, EN) mit i18next
- 📝 **Winston Logging** - Strukturiertes JSON-Logging
- 📚 **Swagger API-Docs** - Interactive API-Dokumentation
- 🗄️ **PostgreSQL** - Vollständiges DB-Schema
- 🔄 **Event-System** - Modul-Kommunikation via Event-Bus

### 🧩 **Modulare Architektur**
- **Hot-Swap Module** - Aktivieren/Deaktivieren ohne Neustart
- **Saubere Trennung** - Core = Infrastruktur, Module = Features
- **Eigene APIs** - Jedes Modul hat eigene Endpoints
- **Versionierung** - Module unabhängig versionierbar

---

## 📦 Schnellstart

### Voraussetzungen

```bash
node >= 18.0.0
npm >= 9.0.0
PostgreSQL >= 12
```

### Installation

```bash
# Repository klonen
git clone https://github.com/Jan1701/OpenIntraHub.git
cd OpenIntraHub

# Dependencies installieren
npm install

# Environment konfigurieren
cp .env.example .env
# .env bearbeiten mit deinen Werten

# Datenbank initialisieren
npm run db:setup

# Server starten
npm start
```

🎉 **Server läuft auf:** http://localhost:3000

📖 **API-Docs:** http://localhost:3000/api-docs

---

## 🔧 Konfiguration

### Environment Variables (.env)

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=openintrahub
DB_USER=postgres
DB_PASSWORD=your_password

# Security
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=24h

# LDAP (optional)
LDAP_URL=ldap://localhost:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=admin_password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com

# Logging
LOG_LEVEL=info
LOG_TO_FILE=false
```

### Default Admin User

```
Username: admin
Password: admin123
Email: admin@openintrahub.local
```

⚠️ **Wichtig:** Ändere das Passwort nach dem ersten Login!

---

## 🏗️ Architektur

### Core vs. Modules

```
OpenIntraHub/
├── core/                    # 🔷 CORE - Infrastruktur
│   ├── app.js              # Express App
│   ├── auth.js             # JWT + Multi-Auth
│   ├── ldap.js             # LDAP-Integration
│   ├── middleware.js       # Auth-Middleware
│   ├── permissions.js      # RBAC-System
│   ├── logger.js           # Winston Logger
│   ├── database.js         # PostgreSQL Pool
│   ├── swagger.js          # API-Dokumentation
│   └── userService.js      # User-Management
│
├── modules/                # 🧩 MODULES - Features
│   └── example-module/     # Beispiel-Modul
│       ├── manifest.json   # Modul-Metadaten
│       └── index.js        # Modul-Code
│
├── db/                     # 🗄️ DATABASE
│   ├── migrations/         # SQL-Migrations
│   ├── seeds/             # Seed-Data
│   └── migrate.js         # Migration-Tool
│
└── logo/                   # 🎨 BRANDING
    └── ...                # Logos & Icons
```

### Module Context

Jedes Modul bekommt vollen Zugriff auf Core-Funktionen:

```javascript
module.exports = {
    init: (ctx) => {
        const {
            router,           // Express App
            events,           // Event-Bus
            services,         // Database, Logger
            middleware,       // Auth-Middleware
            permissions       // RBAC-System
        } = ctx;

        // Dein Code hier...
    }
};
```

---

## 📚 API-Dokumentation

### Authentication

```bash
# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "name": "Admin",
    "email": "admin@openintrahub.local",
    "role": "admin"
  }
}
```

### Protected Endpoints

```bash
# User Profile (mit Token)
GET /api/user/profile
Header: Authorization: Bearer <token>

# Admin Only
GET /api/admin/users
Header: Authorization: Bearer <admin-token>

# Permission-based
POST /api/content
Header: Authorization: Bearer <token-with-content.create>
```

**Vollständige API-Docs:** http://localhost:3000/api-docs

---

## 🌍 Internationalisierung (i18n)

OpenIntraHub unterstützt Mehrsprachigkeit mit **i18next**.

### Unterstützte Sprachen

- 🇩🇪 **Deutsch (DE)** - Standard
- 🇬🇧 **English (EN)**

### Sprachumschaltung

```bash
# Query-Parameter
GET /api/example/hello?lang=en

# Accept-Language Header
curl -H "Accept-Language: en" http://localhost:3000/api/example/hello

# Cookie (automatisch gesetzt nach Sprachwahl)
Cookie: i18next=en
```

### API-Endpunkte

```bash
# Aktuelle Sprachpräferenz abrufen
GET /api/user/language
Header: Authorization: Bearer <token>

# Sprachpräferenz ändern
PUT /api/user/language
Header: Authorization: Bearer <token>
Body: { "language": "en" }

# Unterstützte Sprachen auflisten
GET /api/languages
```

### Verwendung in Modulen

```javascript
module.exports = {
    init: (ctx) => {
        const { router, i18n } = ctx;

        router.get('/api/module/hello', (req, res) => {
            res.json({
                message: req.t('common:app.welcome', { name: 'Module' }),
                language: req.language
            });
        });
    }
};
```

### Übersetzungsdateien

Übersetzungen befinden sich in `/locales/{lang}/{namespace}.json`:

- `common.json` - Allgemeine Begriffe
- `auth.json` - Authentifizierung & Autorisierung
- `errors.json` - Fehlermeldungen
- `validation.json` - Validierungsmeldungen
- `module_{name}.json` - Modul-spezifische Übersetzungen

---

## 🗄️ Datenbank

### Schema

- **users** - User-Verwaltung (Multi-Auth)
- **sessions** - JWT-Token-Tracking
- **audit_log** - Security Audit-Trail

### Migrations

```bash
# Alle Migrations ausführen
npm run db:migrate

# Admin-User erstellen
npm run db:seed

# Complete Setup
npm run db:setup
```

**Doku:** [db/README.md](db/README.md)

---

## 🔐 Sicherheit

### Implementiert

✅ JWT-Token-basierte Authentifizierung
✅ bcrypt Password-Hashing (10 rounds)
✅ RBAC mit 5 Rollen & 20+ Permissions
✅ SQL Injection Prevention (Prepared Statements)
✅ Input-Validierung
✅ Rate Limiting
✅ Audit-Logging
✅ Graceful Shutdown

### Sicherheitslücken melden

📧 **jg@linxpress.de**

**Bitte NICHT über GitHub Issues melden!**

Mehr: [SECURITY.md](SECURITY.md)

---

## 🤝 Contributing

Wir freuen uns über Beiträge! 🎉

1. Fork das Repository
2. Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Feature: Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request öffnen

**Guidelines:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📋 Roadmap

### ✅ v0.1 (Current)
- [x] Core-System (Auth, RBAC, Logging)
- [x] PostgreSQL-Integration
- [x] LDAP-Support
- [x] Mehrsprachigkeit (i18n)
- [x] API-Dokumentation
- [x] Module-System

### 🔜 v0.2 (Next)
- [ ] Frontend/Admin-Dashboard
- [ ] User-Management UI
- [ ] Docker Support
- [ ] CI/CD Pipeline
- [ ] Unit Tests

### 📅 v0.3 (Future)
- [ ] Chat-Modul
- [ ] Wiki-Modul
- [ ] File-Management
- [ ] Calendar-Modul
- [ ] Activity Feed

---

## 📄 Lizenz

Apache License 2.0 - siehe [LICENSE](LICENSE)

```
Copyright 2024 Jan Günther (jg@linxpress.de)

Licensed under the Apache License, Version 2.0
```

---

## 👨‍💻 Autor

**Jan Günther**
- Email: jg@linxpress.de
- GitHub: [@Jan1701](https://github.com/Jan1701)

---

## 🙏 Danksagung

Dieses Projekt nutzt großartige Open-Source-Software:

- [Express.js](https://expressjs.com/) - Web Framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Winston](https://github.com/winstonjs/winston) - Logging
- [Swagger](https://swagger.io/) - API Documentation
- [JWT](https://jwt.io/) - Authentication

---

<div align="center">

**Made with ❤️ for the Intranet Community**

[Report Bug](https://github.com/Jan1701/OpenIntraHub/issues) · [Request Feature](https://github.com/Jan1701/OpenIntraHub/issues) · [Discussions](https://github.com/Jan1701/OpenIntraHub/discussions)

</div>
