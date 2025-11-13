# OpenIntraHub

OpenIntraHub ist eine moderne, offene **Social-Intranet-Plattform** mit einer klaren Trennung zwischen **Core** und **Modules**.  
Der **Core** liefert das Basis-System, während **Module** sämtliche Funktionen, Erweiterungen und Integrationen liefern – sauber getrennt, erweiterbar und update-sicher.

---

## 🚀 Projektstatus
Das Projekt befindet sich im **Startaufbau**.  
Die Core-Architektur wird definiert, das erste Modul-System gestaltet und die Basis-Dienste vorbereitet.

---

# 🧩 Architektur-Philosophie: Core vs. Module

## 🔷 CORE (Hauptsystem)
Der **Core** umfasst:

- API-Gateway  
- Authentifizierung & Nutzerverwaltung  
- UI-Framework & Designsystem  
- Event-Bus / Messaging  
- Datenbankstruktur (Basis-Entities)  
- Security Layer  
- Rechte- & Rollenverwaltung  
- Logging, Auditing  
- Module Loader (Hot-Swap, Enable/Disable)  

➡ **Der Core ist minimal und extrem stabil.**  
➡ **Keine Business-Logik im Core!**  
➡ Alles Funktionsverhalten kommt durch **Module**.

---

## 🧩 MODULES (Erweiterungen)
Module liefern **alle Features**, streng getrennt vom Core.

### Beispiel-Module (geplant)
- **Profile Module** – Nutzerprofile, Status, Aktivität  
- **Chat Module** – Chats, Gruppen, Notifications  
- **Wiki Module** – Wissensdatenbank  
- **Files Module** – Dateiablage, Versionierung  
- **Calendar Module** – Termine, Events  
- **Tasks Module** – Aufgaben, Projektplanung  
- **Admin Module** – Dashboard, Statistiken  

### Module-Eigenschaften
- separat entwickelbar  
- eigene API-Endpunkte  
- eigener UI-Bereich  
- unabhängig versionierbar  
- können per config aktiviert/deaktiviert werden  

➡ Ziel: Ein **echtes modulares Framework**, nicht nur Erweiterungen.

---

# 🗺️ Geplante Kernfunktionen

### Kommunikation
- Activity Feed  
- Chats  
- Benachrichtigungen  
- Teams & Räume  

### Zusammenarbeit
- Wiki  
- Aufgaben  
- Kalender  
- Dateiablage  

### Verwaltung
- Rollen & Rechte  
- Benutzer- & Gruppenverwaltung  
- Logging & Audits  

---

## 🐳 Docker & Deployment (geplant)

OpenIntraHub wird vollständig containerisiert:

- **Core Container**
- **Module Container** (optional einzeln)
- Datenbank (PostgreSQL)
- Reverse Proxy (Traefik/Nginx)

Beispiel `docker-compose.yml` (Core + Module):

```yaml
version: '3'
services:
  core:
    image: openintrahub/core
    container_name: openintrahub-core
    ports:
      - "8080:8080"

  wiki_module:
    image: openintrahub/wiki
    depends_on:
      - core

  chat_module:
    image: openintrahub/chat
    depends_on:
      - core
