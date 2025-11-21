# 🚀 OpenIntraHub Deployment Guide

## Production Deployment auf Debian mit Nginx Proxy Manager

### Voraussetzungen

- **Debian 11/12** Server
- **Docker & Docker Compose** installiert
- **Nginx Proxy Manager** (NPM) läuft bereits
- **Domain** mit DNS-Eintrag auf Server (z.B. `intranet.example.com`)
- **SSL-Zertifikat** (Let's Encrypt via NPM)

---

## 1. Server-Vorbereitung

### Docker & Docker Compose installieren

```bash
# Docker installieren
curl -fsSL https://get.docker.com | bash

# Docker Compose installieren
sudo apt-get update
sudo apt-get install docker-compose-plugin

# User zu docker Gruppe hinzufügen
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### Git Repository clonen

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
cp .env.production.example .env
nano .env
```

**Wichtige Werte ändern:**

```bash
# JWT Secret generieren
openssl rand -hex 64

# In .env einfügen:
JWT_SECRET=<generierter-hex-wert>

# Starke Passwörter setzen:
DB_PASSWORD=<starkes-db-password>
REDIS_PASSWORD=<starkes-redis-password>

# Frontend URL (deine Domain):
FRONTEND_URL=https://intranet.example.com
```

### LDAP/AD Integration (optional)

Wenn du Active Directory hast:

```bash
LDAP_ENABLED=true
LDAP_URL=ldap://your-ad-server.local:389
LDAP_BIND_DN=CN=Service Account,OU=Users,DC=example,DC=local
LDAP_BIND_PASSWORD=<service-account-password>
LDAP_SEARCH_BASE=DC=example,DC=local
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
```

---

## 3. Docker Container starten

### Build & Start

```bash
# Production Build
docker compose -f docker-compose.production.yml build

# Start Services
docker compose -f docker-compose.production.yml up -d

# Logs prüfen
docker compose -f docker-compose.production.yml logs -f app
```

### Datenbank initialisieren

```bash
# Migrations ausführen
docker compose -f docker-compose.production.yml exec app npm run db:migrate

# Admin-User erstellen
docker compose -f docker-compose.production.yml exec app npm run db:seed
```

**Standard Admin-Login:**
- Username: `admin`
- Password: `Admin123!`
**⚠️ WICHTIG: Sofort nach erstem Login ändern!**

---

## 4. Nginx Proxy Manager Setup

### In NPM Web-Interface (z.B. http://server-ip:81)

#### 4.1 Proxy Host hinzufügen

**Tab: Proxy Hosts → Add Proxy Host**

**Details:**

```
Domain Names: intranet.example.com
Scheme: http
Forward Hostname/IP: 127.0.0.1  (oder Docker-Bridge-IP)
Forward Port: 3000

☑ Block Common Exploits
☑ Websockets Support  (WICHTIG für Socket.io Chat!)
```

**SSL:**

```
☑ Force SSL
☑ HTTP/2 Support
☑ HSTS Enabled

SSL Certificate: Request a new SSL Certificate (Let's Encrypt)
☑ I Agree to the Let's Encrypt Terms of Service
Email: your-email@example.com
```

**Advanced (Optional):**

```nginx
# Für bessere WebSocket-Performance
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;

# Headers für Socket.io
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# File Upload Size
client_max_body_size 25M;
```

#### 4.2 Access List (optional)

Falls nur intern erreichbar:

**Tab: Access Lists → Add Access List**

```
Name: OpenIntraHub Internal
Satisfy Any: ☐

Authorization:
☑ Username/Password
  User: internal
  Password: <starkes-password>

OR

Access:
  Allow: 10.0.0.0/8    (Dein internes Netzwerk)
  Allow: 192.168.0.0/16
  Deny: all
```

---

## 5. Health Checks

### Prüfen ob alles läuft

```bash
# Container Status
docker compose -f docker-compose.production.yml ps

# Logs
docker compose -f docker-compose.production.yml logs -f app

# Health Endpoint
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"2025-01-21T..."}

# Frontend (nach NPM Setup)
curl https://intranet.example.com/api/health
```

### Socket.io Chat testen

Browser-Console (nach Login):

```javascript
// Socket.io verbinden
const socket = io('https://intranet.example.com/chat', {
    auth: {
        token: localStorage.getItem('token')
    }
});

socket.on('connect', () => {
    console.log('✅ Chat connected!');
});

socket.on('user:online', (data) => {
    console.log('User online:', data);
});
```

---

## 6. Maintenance & Updates

### Update auf neue Version

```bash
cd /opt/OpenIntraHub

# Pull latest changes
git pull origin main

# Rebuild & Restart
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d

# Run new migrations
docker compose -f docker-compose.production.yml exec app npm run db:migrate
```

### Backups

```bash
# PostgreSQL Backup
docker compose -f docker-compose.production.yml exec postgres \
    pg_dump -U openintrahub openintrahub > backup-$(date +%Y%m%d).sql

# Restore
docker compose -f docker-compose.production.yml exec -T postgres \
    psql -U openintrahub openintrahub < backup-20250121.sql
```

### Logs rotieren

```bash
# In docker-compose.production.yml logging hinzufügen:
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 7. Monitoring (Optional)

### Portainer

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

### Prometheus + Grafana (später)

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

---

## 8. Firewall Setup (UFW)

```bash
# UFW aktivieren
sudo ufw enable

# SSH erlauben
sudo ufw allow 22/tcp

# HTTP/HTTPS (für NPM)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# NPM Admin (nur von bestimmter IP)
sudo ufw allow from YOUR_ADMIN_IP to any port 81

# Alles andere blocken
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Status prüfen
sudo ufw status verbose
```

---

## 9. Troubleshooting

### Container startet nicht

```bash
# Logs checken
docker compose -f docker-compose.production.yml logs app

# Häufige Probleme:
# - DB_PASSWORD nicht gesetzt → .env prüfen
# - PostgreSQL nicht ready → healthcheck abwarten
# - Port 3000 belegt → netstat -tulpn | grep 3000
```

### Socket.io verbindet nicht

```bash
# NPM: Websockets Support aktiviert? ✓
# Browser-Console: CORS-Error?
# → FRONTEND_URL in .env korrekt gesetzt?

# Test:
curl -I https://intranet.example.com/socket.io/socket.io.js
# Expected: HTTP 200
```

### Performance Probleme

```bash
# PostgreSQL Performance tuning
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

- [ ] JWT_SECRET ist stark und zufällig generiert
- [ ] DB_PASSWORD und REDIS_PASSWORD sind stark
- [ ] Admin-Passwort nach erstem Login geändert
- [ ] Firewall (UFW) aktiv
- [ ] SSL-Zertifikat läuft (Let's Encrypt Auto-Renewal)
- [ ] Backups automatisiert (Cron-Job)
- [ ] Nur notwendige Ports offen
- [ ] Docker Containers laufen als non-root (später)
- [ ] PostgreSQL & Redis nur von localhost erreichbar
- [ ] Logs werden rotiert

---

## 🎉 Fertig!

Dein OpenIntraHub läuft jetzt auf:

**Frontend:** `https://intranet.example.com`
**API:** `https://intranet.example.com/api`
**Swagger Docs:** `https://intranet.example.com/api-docs`
**Socket.io Chat:** `wss://intranet.example.com/chat`

---

## Support & Community

- **GitHub Issues:** https://github.com/Jan1701/OpenIntraHub/issues
- **Discord:** (coming soon)
- **Docs:** https://docs.openintrahub.org (coming soon)

---

**Made with ❤️ in Europe | AGPLv3 License | Jan Günther <jg@linxpress.de>**
