# Security Policy

## 🔒 Sicherheit bei OpenIntraHub

Die Sicherheit von OpenIntraHub hat höchste Priorität. Wir nehmen alle Sicherheitsprobleme ernst und schätzen die Hilfe der Security-Community.

## 🐛 Sicherheitslücken melden

**Bitte melde Sicherheitslücken NICHT über öffentliche GitHub Issues!**

### Kontakt

Melde Sicherheitsprobleme vertraulich an:

📧 **Email:** jg@linxpress.de

**Subject:** `[SECURITY] Beschreibung des Problems`

### Was solltest du berichten?

- Beschreibung der Schwachstelle
- Steps to Reproduce
- Potenzielle Auswirkungen
- Mögliche Fixes (optional)

### Was du erwarten kannst

1. **Bestätigung** innerhalb von 48 Stunden
2. **Erste Einschätzung** innerhalb von 7 Tagen
3. **Updates** zum Fortschritt alle 14 Tage
4. **Fix & Release** je nach Schweregrad

## 🛡️ Unterstützte Versionen

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | ✅ Yes (Current)   |
| < 0.1   | ❌ No              |

## 🔐 Sicherheits-Features

### Aktuelle Implementierungen

✅ **Authentifizierung:**
- JWT Token-basiert
- bcrypt Password Hashing (10 rounds)
- LDAP-Integration
- Session-Tracking

✅ **Autorisierung:**
- RBAC (Role-Based Access Control)
- 5 Rollen: admin, moderator, editor, user, guest
- 20+ granulare Permissions
- Permission-basierte Middleware

✅ **Input-Validierung:**
- Request-Parameter-Validierung
- SQL Injection Prevention (Prepared Statements)
- XSS-Protection via Input-Sanitization
- Length-Checks auf Username/Password

✅ **Logging & Auditing:**
- Winston Structured Logging
- Audit-Log für sicherheitsrelevante Aktionen
- IP-Tracking bei Login-Versuchen
- Fehler-Logging ohne sensitive Daten

✅ **API-Sicherheit:**
- CORS-Configuration
- Rate Limiting
- 404/500 Error-Handler
- Keine Stack-Traces in Production

### Geplante Features

⏳ **2FA (Two-Factor Authentication)**
⏳ **CSRF Protection**
⏳ **Content Security Policy Headers**
⏳ **IP Whitelisting/Blacklisting**
⏳ **Advanced Rate Limiting (per User/IP)**

## 🔒 Best Practices für Deployments

### Environment Variables

**Niemals in Git committen:**
```bash
# .env sollte in .gitignore sein!
JWT_SECRET=          # Verwende starke, zufällige Secrets
DB_PASSWORD=         # Starke Passwörter
LDAP_BIND_PASSWORD=  # Niemals plain-text
```

**Secrets generieren:**
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Admin Password
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Database

```bash
# PostgreSQL User mit minimalen Rechten
CREATE USER openintrahub_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE openintrahub TO openintrahub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openintrahub_app;

# Niemals mit postgres-Superuser laufen lassen!
```

### HTTPS

```bash
# Immer HTTPS in Production verwenden
# Reverse Proxy (nginx/traefik) für SSL-Terminierung
```

### Updates

```bash
# Regelmäßig Dependencies aktualisieren
npm audit
npm audit fix

# Security Updates sofort einspielen!
```

## ⚠️ Bekannte Einschränkungen

### Development-Mode

⚠️ **Mock-User:** In Development existiert ein Mock-User (`admin/admin123`)
- **NUR für Development!**
- Wird in Production automatisch deaktiviert wenn `NODE_ENV=production`

⚠️ **LDAP:** Ohne LDAP-Config fällt Auth auf Database/Mock zurück

⚠️ **Swagger UI:** API-Docs sollten in Production deaktiviert/geschützt werden

## 📋 Security Checklist für Production

- [ ] `NODE_ENV=production` gesetzt
- [ ] `JWT_SECRET` mit starkem, zufälligem Wert
- [ ] `DB_PASSWORD` mit starkem Passwort
- [ ] HTTPS aktiviert (SSL-Terminierung)
- [ ] Firewall konfiguriert (nur Port 443/80)
- [ ] PostgreSQL User mit minimalen Rechten
- [ ] Admin-Passwort geändert (nicht `admin123`!)
- [ ] LDAP konfiguriert (oder Mock deaktiviert)
- [ ] Logging nach `/logs` aktiviert
- [ ] Regular Backups eingerichtet
- [ ] `npm audit` ohne kritische Issues
- [ ] Rate Limiting aktiviert
- [ ] CORS auf spezifische Origins beschränkt

## 🎖️ Hall of Fame

Wir danken allen, die verantwortungsvoll Sicherheitsprobleme gemeldet haben:

*Noch keine Einträge - du könntest der Erste sein!*

## 📚 Weitere Ressourcen

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Danke, dass du OpenIntraHub sicherer machst! 🙏**
