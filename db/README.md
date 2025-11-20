# OpenIntraHub - Datenbank

Dieses Verzeichnis enthält alle Datenbank-Migrations und Seed-Scripts.

## 📁 Struktur

```
db/
├── migrations/          # SQL-Migrations (werden in Reihenfolge ausgeführt)
│   ├── 001_create_users_table.sql
│   ├── 002_create_sessions_table.sql
│   └── 003_create_audit_log_table.sql
├── seeds/               # Seed-Scripts für initiale Daten
│   └── 001_seed_admin_user.js
├── migrate.js           # Migrations-Tool
└── README.md           # Diese Datei
```

## 🚀 Schnellstart

### 1. PostgreSQL einrichten

```bash
# PostgreSQL installieren (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# PostgreSQL starten
sudo service postgresql start

# Datenbank erstellen
sudo -u postgres createdb openintrahub

# User erstellen (optional)
sudo -u postgres createuser -P openintrahub_user
```

### 2. .env konfigurieren

```bash
# .env.example kopieren
cp .env.example .env

# Datenbank-Konfiguration bearbeiten
nano .env
```

Setze folgende Werte:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=openintrahub
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Datenbank initialisieren

```bash
# Alle Migrations ausführen + Admin-User erstellen
npm run db:setup

# Oder einzeln:
npm run db:migrate    # Nur Migrations
npm run db:seed       # Nur Seed-Daten
```

## 📊 Datenbank-Schema

### **users** - User-Tabelle
```sql
- id: SERIAL PRIMARY KEY
- username: VARCHAR(100) UNIQUE
- email: VARCHAR(255) UNIQUE
- password_hash: VARCHAR(255)
- name: VARCHAR(255)
- role: VARCHAR(50) (admin, moderator, editor, user, guest)
- auth_method: VARCHAR(20) (database, ldap, oauth)
- is_active: BOOLEAN
- is_verified: BOOLEAN
- ldap_dn: VARCHAR(500)
- avatar_url: VARCHAR(500)
- created_at, updated_at, last_login_at: TIMESTAMP
```

### **sessions** - Aktive Sessions
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (FK users)
- token_hash: VARCHAR(255) UNIQUE
- ip_address: INET
- user_agent: TEXT
- device_info: JSONB
- created_at, expires_at, last_activity_at: TIMESTAMP
- is_active: BOOLEAN
- revoked_at, revoked_reason: VARCHAR
```

### **audit_log** - Audit-Trail
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER (FK users)
- username: VARCHAR(100)
- action: VARCHAR(100)
- resource_type, resource_id: VARCHAR
- description: TEXT
- changes: JSONB
- ip_address: INET
- user_agent: TEXT
- status: VARCHAR(20) (success, failure, error)
- created_at: TIMESTAMP
```

## 🛠️ Migrations erstellen

Neue Migration hinzufügen:

```bash
# Datei erstellen mit fortlaufender Nummer
touch db/migrations/004_create_my_table.sql
```

Beispiel-Migration:
```sql
-- Migration: Beschreibung
DROP TABLE IF EXISTS my_table CASCADE;

CREATE TABLE my_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_my_table_name ON my_table(name);
```

Dann ausführen:
```bash
npm run db:migrate
```

## 👤 Admin-User

Der Seed-Script erstellt einen initialen Admin-User:

**Standard-Zugangsdaten:**
- Username: `admin`
- Password: `admin123`
- Email: `admin@openintrahub.local`

**Eigene Credentials:**
```bash
ADMIN_USERNAME=myadmin \
ADMIN_PASSWORD=mypassword \
ADMIN_EMAIL=admin@example.com \
npm run db:seed
```

⚠️ **Wichtig:** Ändere das Admin-Passwort nach dem ersten Login!

## 🔧 Nützliche Befehle

```bash
# PostgreSQL-Console öffnen
sudo -u postgres psql openintrahub

# Alle Tabellen anzeigen
\dt

# Tabellen-Schema anzeigen
\d users

# User anzeigen
SELECT id, username, email, role FROM users;

# Migrations-Status prüfen
SELECT * FROM migrations ORDER BY id;

# Audit-Log der letzten 10 Aktionen
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

## 🔄 Rollback

Aktuell gibt es kein automatisches Rollback. Für Rollback:

1. Manuell via SQL rückgängig machen
2. Oder: Datenbank neu aufsetzen

```bash
# Datenbank komplett zurücksetzen (⚠️ Löscht alle Daten!)
sudo -u postgres psql -c "DROP DATABASE openintrahub;"
sudo -u postgres psql -c "CREATE DATABASE openintrahub;"
npm run db:setup
```

## 📝 Best Practices

1. **Niemals** Migrations nach Deployment ändern
2. **Immer** Backups vor Migrations in Production
3. **Teste** Migrations zuerst in Development
4. **Dokumentiere** komplexe Migrations im SQL-Kommentar
5. **Verwende** Transactions für kritische Änderungen

## 🔐 Sicherheit

- **Passwörter** werden mit bcrypt gehasht (10 rounds)
- **Sessions** speichern nur Token-Hashes, nie die Token selbst
- **Audit-Log** trackt alle sicherheitsrelevanten Aktionen
- **LDAP DN** wird für LDAP-Auth-Users gespeichert

## 📚 Weitere Resourcen

- [PostgreSQL Dokumentation](https://www.postgresql.org/docs/)
- [bcrypt npm Package](https://www.npmjs.com/package/bcrypt)
- [node-postgres (pg)](https://node-postgres.com/)
