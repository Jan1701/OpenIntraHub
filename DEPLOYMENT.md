# OpenIntraHub Deployment Guide

## Production Deployment auf Debian mit Docker & Nginx Proxy Manager

### Voraussetzungen

- **Debian 11/12** Server (oder Ubuntu 22.04+)
- **Docker & Docker Compose** installiert
- **Nginx Proxy Manager** (NPM) oder anderer Reverse Proxy
- **Domain** mit DNS-Eintrag auf Server
- **SSL-Zertifikat** (Let's Encrypt empfohlen)

---

## 1. Server-Vorbereitung

### Docker & Docker Compose installieren

```bash
# Docker installieren
curl -fsSL https://get.docker.com | bash

# Docker Compose Plugin installieren
sudo apt-get update
sudo apt-get install docker-compose-plugin

# User zur docker Gruppe hinzufuegen
sudo usermod -aG docker $USER
newgrp docker

# Verifizieren
docker --version
docker compose version
```

### Git Repository klonen

```bash
cd /opt
sudo git clone https://github.com/Jan1701/OpenIntraHub.git
cd OpenIntraHub
sudo chown -R $USER:$USER .
```

---

## 2. Konfiguration

### Environment-Datei erstellen

```bash
cp .env.example .env
nano .env
```

### Wichtige Werte konfigurieren

```bash
# Sichere Secrets generieren
openssl rand -hex 64  # Fuer JWT_SECRET
openssl rand -hex 32  # Fuer EXCHANGE_ENCRYPTION_KEY

# In .env einfuegen:
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://intranet.example.com

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=openintrahub
DB_USER=openintrahub
DB_PASSWORD=<starkes-db-password>

# Security
JWT_SECRET=<generierter-hex-wert>
JWT_EXPIRES_IN=24h

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# File Storage
DRIVE_UPLOAD_DIR=/app/uploads/drive
DRIVE_MAX_FILE_SIZE=104857600
DRIVE_USER_QUOTA=5368709120

# Logging
LOG_LEVEL=info
```

### LDAP/AD Integration (optional)

```bash
LDAP_ENABLED=true
LDAP_URL=ldap://your-ad-server.local:389
LDAP_BIND_DN=CN=Service Account,OU=Users,DC=example,DC=local
LDAP_BIND_PASSWORD=<service-account-password>
LDAP_SEARCH_BASE=DC=example,DC=local
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_IS_AD=true
LDAP_AD_DOMAIN=example.local

# Automatische Synchronisation
LDAP_SYNC_ENABLED=true
LDAP_SYNC_SCHEDULE=0 */6 * * *
```

### Exchange Integration (optional)

```bash
EXCHANGE_ENABLED=true
EXCHANGE_DEFAULT_SERVER=https://mail.company.com/EWS/Exchange.asmx
EXCHANGE_DEFAULT_AUTH_TYPE=ntlm
EXCHANGE_ENCRYPTION_KEY=<generierter-hex-wert>
EXCHANGE_SYNC_INTERVAL_MINUTES=15
```

---

## 3. Docker Container starten

### Build & Start

```bash
# Production Build
docker compose -f docker-compose.production.yml build

# Container starten
docker compose -f docker-compose.production.yml up -d

# Logs pruefen
docker compose -f docker-compose.production.yml logs -f app
```

### Datenbank initialisieren

```bash
# Migrations ausfuehren
docker compose -f docker-compose.production.yml exec app npm run db:migrate

# Admin-User erstellen (Seed)
docker compose -f docker-compose.production.yml exec app npm run db:seed
```

### Standard Admin-Login

```
Username: admin
Password: Admin123!
```

**WICHTIG:** Passwort sofort nach erstem Login aendern!

---

## 4. Nginx Proxy Manager Setup

### In NPM Web-Interface (http://server-ip:81)

#### 4.1 Proxy Host hinzufuegen

**Tab: Proxy Hosts -> Add Proxy Host**

**Details:**
```
Domain Names: intranet.example.com
Scheme: http
Forward Hostname/IP: 127.0.0.1
Forward Port: 3000

[x] Block Common Exploits
[x] Websockets Support  (WICHTIG fuer Socket.io!)
```

**SSL:**
```
[x] Force SSL
[x] HTTP/2 Support
[x] HSTS Enabled

SSL Certificate: Request a new SSL Certificate (Let's Encrypt)
[x] I Agree to the Let's Encrypt Terms of Service
Email: your-email@example.com
```

**Advanced (Custom Nginx Configuration):**
```nginx
# WebSocket Support fuer Chat & Real-time
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;

# Headers
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# File Upload Size (fuer Drive)
client_max_body_size 100M;
```

---

## 5. Health Checks

### Container Status pruefen

```bash
# Status aller Container
docker compose -f docker-compose.production.yml ps

# Logs anzeigen
docker compose -f docker-compose.production.yml logs -f app

# Health Endpoint testen
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Nach NPM Setup
curl https://intranet.example.com/api/health
```

### Socket.io testen (Browser Console)

```javascript
const socket = io('https://intranet.example.com/chat', {
    auth: { token: localStorage.getItem('token') }
});

socket.on('connect', () => console.log('Chat connected!'));
socket.on('connect_error', (err) => console.error('Error:', err));
```

---

## 6. Wartung & Updates

### Update auf neue Version

```bash
cd /opt/OpenIntraHub

# Backup erstellen (siehe unten)

# Latest changes pullen
git pull origin main

# Rebuild & Restart
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d

# Neue Migrations ausfuehren
docker compose -f docker-compose.production.yml exec app npm run db:migrate
```

### Backups

```bash
# PostgreSQL Backup
docker compose -f docker-compose.production.yml exec postgres \
    pg_dump -U openintrahub openintrahub > backup-$(date +%Y%m%d).sql

# Drive Files Backup
tar -czvf drive-backup-$(date +%Y%m%d).tar.gz uploads/

# Restore Database
docker compose -f docker-compose.production.yml exec -T postgres \
    psql -U openintrahub openintrahub < backup-20251121.sql
```

### Automatisches Backup (Cron)

```bash
# Crontab bearbeiten
crontab -e

# Taeglich um 3 Uhr morgens
0 3 * * * cd /opt/OpenIntraHub && docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U openintrahub openintrahub > /backup/db-$(date +\%Y\%m\%d).sql

# Woechentlich Drive Backup
0 4 * * 0 tar -czvf /backup/drive-$(date +\%Y\%m\%d).tar.gz /opt/OpenIntraHub/uploads/
```

### Log Rotation

```yaml
# In docker-compose.production.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
```

---

## 7. Monitoring (Optional)

### Portainer (Container Management)

```bash
docker run -d \
    --name portainer \
    --restart=always \
    -p 9000:9000 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data \
    portainer/portainer-ce:latest
```

Access: `http://server-ip:9000`

### Prometheus + Grafana (Metrics)

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - openintrahub-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - openintrahub-network

networks:
  openintrahub-network:
    external: true
```

---

## 8. Firewall Setup (UFW)

```bash
# UFW aktivieren
sudo ufw enable

# SSH erlauben
sudo ufw allow 22/tcp

# HTTP/HTTPS (fuer NPM)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# NPM Admin (nur von bestimmter IP)
sudo ufw allow from YOUR_ADMIN_IP to any port 81

# Alles andere blocken
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Status pruefen
sudo ufw status verbose
```

---

## 9. Troubleshooting

### Container startet nicht

```bash
# Logs checken
docker compose -f docker-compose.production.yml logs app

# Haeufige Probleme:
# - DB_PASSWORD nicht gesetzt -> .env pruefen
# - PostgreSQL nicht ready -> healthcheck abwarten
# - Port 3000 belegt -> netstat -tulpn | grep 3000
```

### Datenbank-Verbindungsfehler

```bash
# PostgreSQL Container pruefen
docker compose -f docker-compose.production.yml exec postgres pg_isready -U openintrahub

# Verbindung testen
docker compose -f docker-compose.production.yml exec app node -e "
const { Pool } = require('pg');
const pool = new Pool();
pool.query('SELECT NOW()').then(r => console.log('OK:', r.rows[0])).catch(console.error);
"
```

### Socket.io verbindet nicht

```bash
# NPM: Websockets Support aktiviert?
# Browser-Console: CORS-Error?
# -> FRONTEND_URL in .env korrekt gesetzt?

# Test WebSocket Endpoint
curl -I https://intranet.example.com/socket.io/socket.io.js
# Expected: HTTP 200
```

### Drive Upload Fehler

```bash
# Upload-Verzeichnis pruefen
docker compose -f docker-compose.production.yml exec app ls -la /app/uploads/

# Berechtigungen korrigieren
docker compose -f docker-compose.production.yml exec app chmod -R 755 /app/uploads/

# Nginx max upload size
# In NPM Advanced: client_max_body_size 100M;
```

### Performance Probleme

```bash
# PostgreSQL Performance Tuning
# In docker-compose.production.yml:
services:
  postgres:
    command: >
      postgres
      -c shared_buffers=256MB
      -c max_connections=200
      -c work_mem=4MB
      -c maintenance_work_mem=64MB

# Redis Memory Limit
services:
  redis:
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

---

## 10. Security Checklist

- [ ] `NODE_ENV=production` gesetzt
- [ ] `JWT_SECRET` mit starkem, zufaelligem Wert (min. 64 Zeichen)
- [ ] `DB_PASSWORD` mit starkem Passwort
- [ ] `EXCHANGE_ENCRYPTION_KEY` gesetzt (falls Exchange aktiv)
- [ ] HTTPS aktiviert (SSL-Terminierung via NPM)
- [ ] Admin-Passwort geaendert (nicht `Admin123!`)
- [ ] Firewall (UFW) aktiv
- [ ] Nur notwendige Ports offen (80, 443)
- [ ] PostgreSQL & Redis nur intern erreichbar
- [ ] Regular Backups eingerichtet
- [ ] Log Rotation aktiviert
- [ ] `npm audit` ohne kritische Issues

---

## 11. Endpoints nach Deployment

| Service | URL |
|---------|-----|
| **Frontend** | `https://intranet.example.com` |
| **API** | `https://intranet.example.com/api` |
| **Swagger Docs** | `https://intranet.example.com/api-docs` |
| **Socket.io Chat** | `wss://intranet.example.com/chat` |
| **Health Check** | `https://intranet.example.com/api/health` |

---

## Support & Community

- **GitHub Issues:** https://github.com/Jan1701/OpenIntraHub/issues
- **Dokumentation:** [README.md](README.md)
- **Security:** [SECURITY.md](SECURITY.md)

---

**Made with Dedication | Apache 2.0 License | Jan Guenther <jg@linxpress.de>**
