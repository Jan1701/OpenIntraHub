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
- 🌍 **i18n** - Mehrsprachigkeit (DE, EN, FR, ES, IT, PL, NL) mit i18next
- 📝 **Winston Logging** - Strukturiertes JSON-Logging
- 📚 **Swagger API-Docs** - Interactive API-Dokumentation
- 🗄️ **PostgreSQL** - Vollständiges DB-Schema
- 🔄 **Event-System** - Modul-Kommunikation via Event-Bus

### 🧩 **Modulare Architektur**
- **Hot-Swap Module** - Aktivieren/Deaktivieren ohne Neustart
- **Saubere Trennung** - Core = Infrastruktur, Module = Features
- **Eigene APIs** - Jedes Modul hat eigene Endpoints
- **Versionierung** - Module unabhängig versionierbar

### 📧 **Exchange Integration & Mail**
- **📅 Bidirektionale Kalender-Synchronisation** - Vollständige 2-Wege-Sync mit Microsoft Exchange
- **📬 Mail Client** - Vollständiger E-Mail-Client mit Inbox, Compose, Attachments
- **🔄 Automatische Synchronisation** - Scheduled Worker synct alle 15 Minuten (konfigurierbar)
- **🏖️ Out of Office (OOF)** - Globale Abwesenheitsverwaltung mit Exchange-Sync
- **📁 Folder Management** - Synchronisiere Exchange-Ordner und -Nachrichten
- **🔐 Verschlüsselte Credentials** - AES-256-GCM Verschlüsselung für Exchange-Zugangsdaten

### 💬 **Chat & Real-time Communication**
- **WebSocket Chat** - Echtzeit-Messaging mit Socket.io
- **👤 User Status** - Globales Präsenz-System (Available, Away, Busy, DND, Offline, OOF)
- **📊 Status History** - Tracking von Status-Änderungen für Analytics
- **💼 Group & Direct Chats** - 1:1 Direktnachrichten und Gruppenchats
- **📎 File Sharing** - Datei-Upload und -Freigabe in Chats
- **✍️ Typing Indicators** - Echtzeit-Tippindikatoren
- **✓ Read Receipts** - Lesebestätigungen für Nachrichten

### 🏗️ **Page Builder & Content**
- **🎨 Drag & Drop Editor** - Visueller Page Builder
- **📝 Posts & Blog** - Rich-Text-Editor mit Kategorien und Tags
- **📅 Events & Calendar** - Event-Management mit Kalenderansicht
- **📍 Locations & Rooms** - Standort- und Raum-Verwaltung
- **🖼️ Media Library** - Zentrale Medienverwaltung

### 🛠️ **Setup & Administration**
- **🚀 Web-basierter Setup-Wizard** - Schritt-für-Schritt Installation
- **🧩 Module Selection** - Wähle Module während der Installation
- **⚙️ Environment Configuration** - Konfiguriere DB, Redis, Exchange im Setup
- **👥 Admin User Creation** - Erstelle Admin-Account im Setup

---

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


**Made with ❤️ for the Intranet Community**

[Report Bug](https://github.com/Jan1701/OpenIntraHub/issues) · [Request Feature](https://github.com/Jan1701/OpenIntraHub/issues) · [Discussions](https://github.com/Jan1701/OpenIntraHub/discussions)


