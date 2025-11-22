# White-Label Anleitung

OpenIntraHub ist vollstaendig White-Label-faehig. Diese Anleitung zeigt, wie Sie die Plattform an Ihr Branding anpassen.

## Schnellstart

### 1. Logo aendern

```bash
# Ersetzen Sie die Logo-Dateien
cp your-logo.png frontend/public/logo/transparent.png
cp your-logo-light.png frontend/public/logo/light.png
cp your-logo-dark.png frontend/public/logo/dark.png
cp your-favicon.ico frontend/public/favicon.ico
```

### 2. Farben anpassen

Bearbeiten Sie `frontend/src/styles/index.css`:

```css
:root {
  /* Ihre Primaerfarbe */
  --color-primary-500: #your-brand-color;
  --color-primary-600: #your-darker-shade;
  --color-primary-700: #your-darkest-shade;
}
```

### 3. App-Name aendern

Bearbeiten Sie `frontend/src/config/theme.js`:

```javascript
const defaultTheme = {
  brand: {
    name: 'Ihr Firmenname',
    tagline: 'Ihr Slogan',
    // ...
  }
};
```

---

## Vollstaendige Anpassung

### Theme-Konfiguration

Die Datei `frontend/src/config/theme.js` bietet umfangreiche Anpassungsmoeglichkeiten:

```javascript
const customTheme = {
  // Markenidentitaet
  brand: {
    name: 'MeinUnternehmen Intranet',
    tagline: 'Gemeinsam besser arbeiten',
    logo: '/logo/custom-logo.svg',
    logoLight: '/logo/custom-logo-white.svg',
    logoDark: '/logo/custom-logo-dark.svg',
    favicon: '/custom-favicon.ico',

    // Komplett entfernen von "Powered by"
    poweredBy: null,
  },

  // Farbpalette
  colors: {
    primary: {
      50: '#e6f3ff',
      100: '#b3d9ff',
      200: '#80bfff',
      300: '#4da6ff',
      400: '#1a8cff',
      500: '#0073e6',  // Basis
      600: '#005cb3',  // Haupt-Akzent
      700: '#004480',
      800: '#002d4d',
      900: '#00171a',
    },
    // ... weitere Farben
  },

  // Navigation anpassen
  navigation: {
    items: [
      { key: 'home', label: 'Start', icon: 'home', path: '/' },
      { key: 'news', label: 'Neuigkeiten', icon: 'newspaper', path: '/posts' },
      // Eigene Navigation definieren
    ],
  },

  // Features aktivieren/deaktivieren
  features: {
    darkMode: true,
    modules: {
      chat: true,
      mail: false,  // E-Mail-Modul deaktivieren
      projects: true,
    },
  },
};
```

### CSS-Variablen

Alle Farben und Layout-Einstellungen nutzen CSS-Variablen:

```css
:root {
  /* Primaerfarben (Ihr Branding) */
  --color-primary-50: #e6f3ff;
  --color-primary-100: #b3d9ff;
  --color-primary-200: #80bfff;
  --color-primary-300: #4da6ff;
  --color-primary-400: #1a8cff;
  --color-primary-500: #0073e6;
  --color-primary-600: #005cb3;
  --color-primary-700: #004480;
  --color-primary-800: #002d4d;
  --color-primary-900: #00171a;

  /* Sekundaerfarben */
  --color-secondary-500: #8b5cf6;
  --color-secondary-600: #7c3aed;

  /* Layout */
  --sidebar-width: 280px;
  --header-height: 72px;

  /* Typografie */
  --font-family: 'Ihre Schriftart', system-ui, sans-serif;
}
```

### Dark Mode

Dark Mode ist vorkonfiguriert. Aktivieren Sie ihn mit:

```html
<html data-theme="dark">
```

Oder per JavaScript:

```javascript
document.documentElement.setAttribute('data-theme', 'dark');
```

---

## Komponenten-Klassen

Vordefinierte CSS-Klassen fuer konsistentes Styling:

### Buttons

```html
<button class="btn btn-primary">Primaer</button>
<button class="btn btn-secondary">Sekundaer</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-danger">Loeschen</button>

<!-- Groessen -->
<button class="btn btn-primary btn-sm">Klein</button>
<button class="btn btn-primary btn-lg">Gross</button>
```

### Cards

```html
<div class="card">
  <h3>Titel</h3>
  <p>Inhalt...</p>
</div>

<div class="card-hover">
  <!-- Mit Hover-Effekt -->
</div>
```

### Inputs

```html
<label class="label">Bezeichnung</label>
<input type="text" class="input" placeholder="Eingabe...">

<!-- Fehlerzustand -->
<input type="text" class="input-error">
```

### Badges

```html
<span class="badge-primary">Neu</span>
<span class="badge-success">Aktiv</span>
<span class="badge-warning">Ausstehend</span>
<span class="badge-error">Fehler</span>
```

### Navigation

```html
<nav>
  <a href="/" class="nav-item">Dashboard</a>
  <a href="/posts" class="nav-item-active">Posts</a>
</nav>
```

### Tabellen

```html
<table class="table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Beispiel</td>
      <td>Aktiv</td>
    </tr>
  </tbody>
</table>
```

---

## Multi-Tenant Setup

Fuer verschiedene Mandanten/Kunden:

### Domain-basiertes Theming

```javascript
// frontend/src/utils/tenant.js
export function getTenantConfig() {
  const hostname = window.location.hostname;

  const tenants = {
    'firma-a.intranet.de': {
      name: 'Firma A',
      primaryColor: '#1e40af',
      logo: '/tenants/firma-a/logo.svg',
    },
    'firma-b.intranet.de': {
      name: 'Firma B',
      primaryColor: '#059669',
      logo: '/tenants/firma-b/logo.svg',
    },
  };

  return tenants[hostname] || defaultConfig;
}
```

### Theme zur Laufzeit anwenden

```javascript
import { applyTheme, getTheme } from './config/theme';
import { getTenantConfig } from './utils/tenant';

// Beim App-Start
const tenantConfig = getTenantConfig();
const customTheme = getTheme({
  brand: {
    name: tenantConfig.name,
    logo: tenantConfig.logo,
  },
  colors: {
    primary: { 600: tenantConfig.primaryColor }
  }
});

applyTheme(customTheme);
```

---

## E-Mail Templates

E-Mail-Templates fuer Benachrichtigungen anpassen:

```
/templates/
  email/
    welcome.html       # Willkommens-E-Mail
    password-reset.html
    notification.html
```

Beispiel-Template:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .header { background: {{PRIMARY_COLOR}}; }
    .logo { max-height: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="{{LOGO_URL}}" class="logo" alt="{{COMPANY_NAME}}">
  </div>
  <div class="content">
    {{CONTENT}}
  </div>
  <div class="footer">
    {{COMPANY_NAME}} - {{TAGLINE}}
  </div>
</body>
</html>
```

---

## Backend Branding

### .env Konfiguration

```bash
# Branding
APP_NAME="MeinUnternehmen Intranet"
APP_URL=https://intranet.meinunternehmen.de
COMPANY_NAME="MeinUnternehmen GmbH"

# E-Mail Absender
MAIL_FROM_NAME="MeinUnternehmen Intranet"
MAIL_FROM_ADDRESS=noreply@meinunternehmen.de
```

### API Responses

Alle API-Responses enthalten keine OpenIntraHub-Referenzen.

---

## Lizenzhinweise

### Was erlaubt ist

- Vollstaendiges Rebranding
- Entfernen aller OpenIntraHub-Referenzen
- Verkauf als eigenes Produkt
- Anpassung fuer Kunden
- SaaS-Betrieb

### Was nicht erforderlich ist

- "Powered by"-Hinweis
- Backlink zu OpenIntraHub
- Lizenzgebuehren
- Support-Vertraege

### Apache 2.0 Lizenz

Die Apache 2.0 Lizenz erlaubt:
- Kommerzielle Nutzung
- Modifikation
- Distribution
- Private Nutzung

Einzige Bedingung:
- Lizenztext muss beibehalten werden (in LICENSE Datei)
- Aenderungen muessen dokumentiert werden (optional, aber empfohlen)

---

## Beispiel: Komplettes Rebranding

### Schritt 1: Fork erstellen

```bash
git clone https://github.com/Jan1701/OpenIntraHub.git mein-intranet
cd mein-intranet
```

### Schritt 2: Branding-Dateien ersetzen

```bash
# Logo-Dateien
cp ~/branding/logo.svg frontend/public/logo/transparent.png
cp ~/branding/favicon.ico frontend/public/favicon.ico

# index.html anpassen
sed -i 's/OpenIntraHub/MeinIntranet/g' frontend/index.html
```

### Schritt 3: Theme anpassen

```bash
# Theme-Datei bearbeiten
nano frontend/src/config/theme.js
```

### Schritt 4: CSS anpassen

```bash
# Farben aendern
nano frontend/src/styles/index.css
```

### Schritt 5: Build erstellen

```bash
cd frontend && npm run build
```

### Schritt 6: Deployen

```bash
docker compose -f docker-compose.production.yml up -d
```

---

## Support

Bei Fragen zum White-Labeling:

- GitHub Issues: https://github.com/Jan1701/OpenIntraHub/issues
- E-Mail: jg@linxpress.de

**Hinweis:** White-Label-Support ist kostenlos und Teil der Open-Source-Lizenz.
