# Security Policy

## Sicherheit bei OpenIntraHub

Die Sicherheit von OpenIntraHub hat hoechste Prioritaet. Wir nehmen alle Sicherheitsprobleme ernst und schaetzen die Hilfe der Security-Community.

---

## Sicherheitsluecken melden

**Bitte melde Sicherheitsluecken NICHT ueber oeffentliche GitHub Issues!**

### Kontakt

Melde Sicherheitsprobleme vertraulich an:

**Email:** jg@linxpress.de

**Subject:** `[SECURITY] Beschreibung des Problems`

### Was solltest du berichten?

- Beschreibung der Schwachstelle
- Steps to Reproduce
- Potenzielle Auswirkungen
- Betroffene Versionen
- Moegliche Fixes (optional)

### Was du erwarten kannst

1. **Bestaetigung** innerhalb von 48 Stunden
2. **Erste Einschaetzung** innerhalb von 7 Tagen
3. **Updates** zum Fortschritt alle 14 Tage
4. **Fix & Release** je nach Schweregrad

---

## Unterstuetzte Versionen

| Version | Status |
|---------|--------|
| 0.1.x | Aktiv unterstuetzt |
| < 0.1 | Nicht unterstuetzt |

---

## Implementierte Sicherheits-Features

### Authentifizierung

- **JWT Token-basiert** - Sichere Token-Authentifizierung
- **bcrypt Password Hashing** - 10 Rounds Hashing
- **LDAP/AD Integration** - Enterprise-Authentifizierung
- **Session-Tracking** - Token-Verwaltung mit Revocation
- **Last-Login Tracking** - Login-Ueberwachung

### Autorisierung

- **RBAC (Role-Based Access Control)**
  - 5 Rollen: Admin, Moderator, Editor, User, Guest
  - 20+ granulare Permissions
- **Permission-basierte Middleware**
- **Resource-Level Access Control**

### Datenverschluesselung

- **AES-256-GCM** - Verschluesselung fuer Exchange Credentials
- **HTTPS/TLS** - Transport-Verschluesselung (via Reverse Proxy)
- **Secure Password Storage** - bcrypt mit Salt

### Input-Validierung

- **Request-Parameter-Validierung**
- **SQL Injection Prevention** - Prepared Statements / Parameterized Queries
- **XSS-Protection** - Input-Sanitization
- **Length-Checks** - Auf kritische Felder (Username, Password, etc.)
- **File Upload Validation** - MIME-Type und Groessen-Pruefung

### Logging & Auditing

- **Winston Structured Logging** - JSON-Format
- **Audit-Log** - Sicherheitsrelevante Aktionen
- **IP-Tracking** - Bei Login-Versuchen
- **Fehler-Logging** - Ohne sensitive Daten in Production
- **User Activity Tracking** - Status-History

### API-Sicherheit

- **CORS-Configuration** - Origin-Beschraenkung
- **Rate Limiting** - Request-Limitierung
- **404/500 Error-Handler** - Keine Stack-Traces in Production
- **Swagger Protection** - API-Docs in Production schuetzen
- **Request Size Limits** - Max. Upload-Groesse

### File Management (Drive)

- **File Hash Verification** - SHA256 fuer Integritaet
- **Visibility Controls** - Private, Shared, Public
- **Access Tokens** - Zeitlich begrenzte Share-Links
- **Download Tracking** - Zugriffs-Logging
- **Storage Quotas** - Pro-User Speicherlimits

---

## Geplante Features

| Feature | Prioritaet | Status |
|---------|-----------|--------|
| 2FA (TOTP) | Hoch | Geplant |
| CSRF Protection | Mittel | Geplant |
| Content Security Policy | Mittel | Geplant |
| IP Whitelisting/Blacklisting | Niedrig | Geplant |
| Advanced Rate Limiting (per User/IP) | Niedrig | Geplant |
| Security Headers (HSTS, X-Frame-Options) | Mittel | Geplant |

---

## Best Practices fuer Deployments

### Environment Variables

**Niemals in Git committen:**

```bash
# .env sollte in .gitignore sein!
JWT_SECRET=                     # Min. 64 Zeichen, zufaellig
DB_PASSWORD=                    # Starkes Passwort
LDAP_BIND_PASSWORD=             # Niemals plain-text
EXCHANGE_ENCRYPTION_KEY=        # 32 Bytes hex
```

**Secrets generieren:**

```bash
# JWT Secret (64 Bytes)
openssl rand -hex 64

# Encryption Key (32 Bytes)
openssl rand -hex 32

# Starkes Passwort
openssl rand -base64 32
```

### Database Security

```sql
-- PostgreSQL User mit minimalen Rechten
CREATE USER openintrahub_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE openintrahub TO openintrahub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openintrahub_app;

-- Niemals mit postgres-Superuser laufen lassen!
```

### Network Security

```bash
# PostgreSQL & Redis nur lokal erreichbar
# In docker-compose.production.yml:
ports:
  - "127.0.0.1:5432:5432"  # Nur localhost
  - "127.0.0.1:6379:6379"  # Nur localhost
```

### HTTPS/TLS

```bash
# Immer HTTPS in Production verwenden
# Reverse Proxy (Nginx/NPM) fuer SSL-Terminierung
# Let's Encrypt fuer kostenlose Zertifikate

# In .env:
FRONTEND_URL=https://intranet.example.com
```

### Updates

```bash
# Regelmaessig Dependencies aktualisieren
npm audit
npm audit fix

# Sicherheits-Updates sofort einspielen!
npm update
```

---

## Bekannte Einschraenkungen

### Development-Mode

**Mock-User:** In Development existiert ein Mock-User (`admin/admin123`)
- NUR fuer Development!
- Wird in Production automatisch deaktiviert wenn `NODE_ENV=production`

**Swagger UI:** API-Docs sollten in Production geschuetzt werden
- Access via Auth oder IP-Whitelist

### File Upload

- Maximale Dateigroesse: 100MB (konfigurierbar)
- Erlaubte MIME-Types: Konfigurierbar
- Kein Virus-Scan (empfohlen: ClamAV Integration)

---

## Security Checklist fuer Production

### Basis-Konfiguration

- [ ] `NODE_ENV=production` gesetzt
- [ ] `JWT_SECRET` mit starkem, zufaelligem Wert (min. 64 Zeichen)
- [ ] `DB_PASSWORD` mit starkem Passwort
- [ ] `EXCHANGE_ENCRYPTION_KEY` gesetzt (falls Exchange aktiv)

### Netzwerk

- [ ] HTTPS aktiviert (SSL-Terminierung)
- [ ] Firewall konfiguriert (nur Port 443/80)
- [ ] PostgreSQL nur von localhost erreichbar
- [ ] Redis nur von localhost erreichbar

### Authentifizierung

- [ ] Admin-Passwort geaendert (nicht `admin123`!)
- [ ] LDAP konfiguriert (oder Mock deaktiviert)
- [ ] JWT Expiration angemessen (z.B. 24h)

### Monitoring

- [ ] Logging aktiviert (`LOG_LEVEL=info`)
- [ ] Audit-Log aktiv
- [ ] Log Rotation eingerichtet

### Backup & Recovery

- [ ] Regular Backups eingerichtet (Datenbank)
- [ ] Drive-Files Backup
- [ ] Recovery-Prozess getestet

### Wartung

- [ ] `npm audit` ohne kritische Issues
- [ ] Update-Prozess dokumentiert
- [ ] Security-Kontakt definiert

---

## Security Headers (Empfohlen)

Falls du einen Reverse Proxy verwendest, setze diese Headers:

```nginx
# Nginx Configuration
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## Incident Response

### Bei Verdacht auf Sicherheitsvorfall

1. **Isolieren** - Betroffene Systeme vom Netzwerk trennen
2. **Dokumentieren** - Alle Beobachtungen festhalten
3. **Analysieren** - Logs pruefen, Ursache identifizieren
4. **Beheben** - Sicherheitsluecke schliessen
5. **Kommunizieren** - Betroffene informieren
6. **Verbessern** - Massnahmen zur Verhinderung implementieren

### Kontakt bei Vorfaellen

**Email:** jg@linxpress.de
**Subject:** `[INCIDENT] Beschreibung`

---

## Hall of Fame

Wir danken allen, die verantwortungsvoll Sicherheitsprobleme gemeldet haben:

*Noch keine Eintraege - du koenntest der Erste sein!*

---

## Weitere Ressourcen

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

**Danke, dass du OpenIntraHub sicherer machst!**
