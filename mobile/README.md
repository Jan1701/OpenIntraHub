# OpenIntraHub Mobile App

Native mobile applications for iOS and Android built with React Native and Expo.

## Features

- **Dashboard** - Quick overview with stats and quick actions
- **Chat** - Real-time messaging with WebSocket support
- **Drive** - File management with upload/download capabilities
- **Projects** - Kanban board for project management
- **And more** - Events, Posts, Mail, Locations

## Tech Stack

- **React Native** 0.76.2
- **Expo** SDK 52
- **Expo Router** - File-based routing
- **React Native Paper** - Material Design components
- **Zustand** - State management
- **Socket.io Client** - Real-time communication
- **i18next** - Internationalization (DE/EN)
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start development server
npm start
```

### Running on Devices

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Web Browser
npm run web
```

### Environment Configuration

Create a `.env` file in the mobile directory:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

For production, update these URLs to your backend server.

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Entry redirect
│   ├── login.tsx          # Login screen
│   ├── (tabs)/            # Tab navigation
│   │   ├── _layout.tsx    # Tab layout
│   │   ├── dashboard.tsx  # Dashboard
│   │   ├── chat.tsx       # Chat list
│   │   ├── drive.tsx      # File manager
│   │   ├── projects.tsx   # Projects list
│   │   └── more.tsx       # More menu
│   ├── chat/
│   │   └── [id].tsx       # Chat conversation
│   └── projects/
│       └── [id].tsx       # Kanban board
├── src/
│   ├── components/        # Reusable components
│   ├── hooks/             # Custom hooks
│   ├── services/          # API & Socket services
│   ├── stores/            # Zustand stores
│   ├── utils/             # Utility functions
│   ├── assets/            # Images, fonts
│   └── i18n.ts            # Translations
├── app.json               # Expo config
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── babel.config.js        # Babel config
```

## Features Overview

### Authentication
- JWT-based authentication
- Secure token storage with Expo SecureStore
- Auto-refresh token handling
- Multi-auth support (Database, LDAP)

### Chat
- Real-time messaging via WebSocket
- Direct messages and group chats
- Typing indicators
- Read receipts
- File attachments

### Drive
- Folder navigation
- File upload/download
- Create folders
- Share files
- File preview

### Projects
- Kanban board view
- Drag & drop tasks (planned)
- Task creation
- Priority indicators
- Assignee management

### Internationalization
- German (DE)
- English (EN)
- Device language detection
- Easy to add more languages

## Building for Production

### Build APK (Android)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build APK
eas build -p android --profile preview
```

### Build IPA (iOS)

```bash
# Build for iOS
eas build -p ios --profile preview
```

### Standalone Builds

```bash
# Android production build
eas build -p android --profile production

# iOS production build
eas build -p ios --profile production
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of OpenIntraHub and is licensed under the Apache 2.0 License.
