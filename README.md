# OpenIntraHub

<div align="center">

![OpenIntraHub Logo](logo/transparent.png)

**Moderne, modulare Enterprise Social-Intranet-Plattform**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![Version](https://img.shields.io/badge/version-0.1.1--alpha-orange.svg)](CHANGELOG.md)
[![GitHub Issues](https://img.shields.io/github/issues/Jan1701/OpenIntraHub)](https://github.com/Jan1701/OpenIntraHub/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Projektstatistiken

| Metrik | Wert |
|--------|------|
| **Gesamter Code** | ~37.649 Zeilen |
| **API-Endpoints** | 215+ REST-Endpoints |
| **Datenbanktabellen** | 66+ Tabellen |
| **Sprachen** | 7 (DE, EN, FR, ES, IT, PL, NL) |
| **Module** | 12 vollständig implementiert |

---

## Features

### Core-System
- **Multi-Authentifizierung** - JWT, LDAP/Active Directory, Datenbank
- **RBAC** - 5 Rollen (Admin, Moderator, Editor, User, Guest), 20+ Permissions
- **Internationalisierung (i18n)** - 7 Sprachen mit i18next
- **Winston Logging** - Strukturiertes JSON-Logging
- **Swagger API-Docs** - Interaktive API-Dokumentation unter `/api-docs`
- **PostgreSQL** - Vollständiges DB-Schema mit 16 Migrationen
- **Redis** - Caching & Session-Management
- **Event-System** - Modul-Kommunikation via Event-Bus
- **WebSocket** - Real-time Kommunikation mit Socket.io

### Modulare Architektur
- **Hot-Swap Module** - Aktivieren/Deaktivieren ohne Neustart
- **Plugin-System** - Erweiterbar durch eigene Module
- **Manifest-basiert** - Module mit manifest.json Metadaten
- **Saubere Trennung** - Core = Infrastruktur, Module = Features

---

## Implementierte Module

### Posts & Blog
- Rich-Text-Editor für Artikel
- Kategorien & Tags System
- SEO-freundliche URLs (Slugs)
- Draft/Published/Archived Status
- Reactions & Kommentare

### Events & Kalender
- Event-Management mit Kalenderansicht
- Teilnehmer-Verwaltung mit RSVP
- Event-Serien (Wiederholungen)
- Alarms/Notifications
- Exchange Calendar Sync

### Chat & Real-time Messaging
- Direct Messages (1:1)
- Group Chats
- WebSocket-basiert (Socket.io)
- File-Sharing & Reactions
- Typing Indicators & Read Receipts

### Mail System (Exchange Integration)
- Vollständiger E-Mail-Client
- Inbox, Compose, View
- Folder-Synchronisation
- Attachment Support
- Verschlüsselte Credentials (AES-256-GCM)

### Drive (Dateiverwaltung)
- Ordner-Hierarchie
- File Versioning & Rollback
- File Deduplication (SHA256)
- Sharing mit Links
- Storage Quotas pro User
- Full-Text Search

### Project Management (Kanban)
- Projekt-Verwaltung mit Status
- Kanban-Boards mit Spalten
- Tasks/Issues mit Priorität
- Timeline-Management
- Progress Tracking
- Drive-Integration pro Projekt

### Locations & Rooms
- Bürostandorte verwalten
- Raum-Management
- Ressourcen-Verwaltung
- Benutzer-Zuordnung
- Offline-Codes

### LDAP/Active Directory
- User-Synchronisation
- Group-Mapping zu Rollen
- Automatische User-Erstellung
- Scheduled Sync (Cron)
- Admin-Panel im Frontend

### User Status & Presence
- 6 Status-Typen: Available, Away, Busy, DND, Offline, OOF
- Out of Office (OOF) Management
- Status-History für Analytics
- Real-time Updates via WebSocket

### Page Builder
- Visueller Drag & Drop Editor
- Module: Text, Bilder, Posts, Videos
- Live Preview
- Responsive Design

### Social Feed
- Activity Feed
- Reactions/Emoji-System
- Kommentare mit Verschachtelung
- User-Mentions

### Setup Wizard
- 7-stufige Web-Installation
- Datenbank-Konfiguration
- LDAP/Exchange-Setup (optional)
- Admin-Benutzer-Erstellung
- Modul-Auswahl

---

## Schnellstart

### Voraussetzungen

```bash
Node.js >= 18.0.0
npm >= 9.0.0
PostgreSQL >= 12
Redis >= 7 (optional, empfohlen)
```

### Installation

```bash
# Repository klonen
git clone https://github.com/Jan1701/OpenIntraHub.git
cd OpenIntraHub

# Backend Dependencies installieren
npm install

# Frontend Dependencies installieren
cd frontend && npm install && cd ..

# Environment konfigurieren
cp .env.example .env
# .env bearbeiten mit deinen Werten

# Datenbank initialisieren
npm run db:setup

# Server starten (Development)
npm run dev

# Oder Production
npm start
```

**Server:** http://localhost:3000
**API-Docs:** http://localhost:3000/api-docs

---

## Docker Deployment

```bash
# Production Build & Start
docker compose -f docker-compose.production.yml up -d

# Datenbank initialisieren
docker compose -f docker-compose.production.yml exec app npm run db:migrate
docker compose -f docker-compose.production.yml exec app npm run db:seed
```

Mehr Details: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Konfiguration

### Environment Variables (.env)

```bash
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://intranet.example.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=openintrahub
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=24h

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# LDAP/Active Directory (optional)
LDAP_ENABLED=false
LDAP_URL=ldap://your-ad-server.local:389
LDAP_BIND_DN=CN=Service Account,OU=Users,DC=example,DC=local
LDAP_BIND_PASSWORD=your_password
LDAP_SEARCH_BASE=DC=example,DC=local

# Exchange Integration (optional)
EXCHANGE_ENABLED=false
EXCHANGE_SYNC_INTERVAL_MINUTES=15
EXCHANGE_ENCRYPTION_KEY=your_encryption_key

# File Storage
DRIVE_UPLOAD_DIR=./uploads/drive
DRIVE_MAX_FILE_SIZE=104857600
DRIVE_USER_QUOTA=5368709120

# Logging
LOG_LEVEL=info
```

### Default Admin User

```
Username: admin
Password: admin123
Email: admin@openintrahub.local
```

**Wichtig:** Passwort nach dem ersten Login ändern!

---


---

## API-Dokumentation

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
    "role": "admin"
  }
}
```

### Protected Endpoints

```bash
# Alle Requests mit Token
Header: Authorization: Bearer <token>

# Beispiel: User Profile
GET /api/user/profile

# Beispiel: Posts erstellen
POST /api/posts
```

**Vollständige Dokumentation:** http://localhost:3000/api-docs

---

## Tech-Stack

### Backend
| Technologie | Version |
|-------------|---------|
| Node.js | >= 18.0.0 |
| Express.js | 4.18.x |
| PostgreSQL | 16 |
| Redis | 7 |
| Socket.io | 4.7.x |
| JWT | 9.x |
| Winston | 3.11.x |
| i18next | 25.x |

### Frontend
| Technologie | Version |
|-------------|---------|
| React | 18.2.x |
| Vite | 5.x |
| Tailwind CSS | 3.3.x |
| Zustand | 4.4.x |
| React Router | 6.x |
| Socket.io Client | 4.7.x |

### DevOps
| Technologie | Beschreibung |
|-------------|--------------|
| Docker | Multi-Stage Build |
| Docker Compose | Orchestrierung |
| Nginx Proxy Manager | Reverse Proxy |
| Let's Encrypt | SSL/TLS |

---

## Sicherheit

### Implementiert
- JWT-Token-basierte Authentifizierung
- bcrypt Password-Hashing (10 rounds)
- RBAC mit 5 Rollen & 20+ Permissions
- SQL Injection Prevention (Prepared Statements)
- AES-256-GCM Verschlüsselung für Credentials
- Input-Validierung
- Rate Limiting
- Audit-Logging

### Sicherheitslücken melden

**Email:** jg@linxpress.de

**Bitte NICHT über GitHub Issues melden!**

Mehr: [SECURITY.md](SECURITY.md)

---

## Roadmap

### v0.1.1-alpha (Aktuell)
- [x] Core-System (Auth, RBAC, Logging, i18n)
- [x] PostgreSQL & Redis Integration
- [x] LDAP/Active Directory Support
- [x] Posts & Blog Module
- [x] Events & Calendar Module
- [x] Chat & Real-time Messaging
- [x] Locations & Rooms Module
- [x] Exchange Integration (Calendar & Mail)
- [x] User Status & Presence System
- [x] Drive (File Management)
- [x] Project Management (Kanban)
- [x] Page Builder (Drag & Drop)
- [x] Social Feed & Reactions
- [x] Web-based Setup Wizard
- [x] Docker Production Setup

### v0.2.0 (Next)
- [ ] Unit & Integration Tests
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Performance Optimierung
- [ ] Advanced Admin Dashboard
- [ ] Notification Center

### v0.3.0 (Future)
- [ ] Wiki Module
- [ ] Workflows & Approvals
- [ ] Advanced Analytics
- [ ] Mobile App (React Native)
- [ ] Plugin Marketplace

---

## Contributing

Wir freuen uns über Beiträge!

1. Fork das Repository
2. Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Feature: Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request öffnen

**Guidelines:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Lizenz

Apache License 2.0 - siehe [LICENSE](LICENSE)

```
Copyright 2024-2025 Jan Guenther (jg@linxpress.de)

Licensed under the Apache License, Version 2.0
```

---

## Autor

**Jan Guenther**
- Email: jg@linxpress.de
- GitHub: [@Jan1701](https://github.com/Jan1701)

---

## Danksagung

Dieses Projekt nutzt großartige Open-Source-Software:

- [Express.js](https://expressjs.com/) - Web Framework
- [React](https://react.dev/) - UI Library
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Cache & Queue
- [Socket.io](https://socket.io/) - Real-time Communication
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Winston](https://github.com/winstonjs/winston) - Logging
- [Swagger](https://swagger.io/) - API Documentation

---

<div align="center">

**Made with Dedication for the Enterprise Intranet Community**

[Report Bug](https://github.com/Jan1701/OpenIntraHub/issues) | [Request Feature](https://github.com/Jan1701/OpenIntraHub/issues) | [Discussions](https://github.com/Jan1701/OpenIntraHub/discussions)

</div>
