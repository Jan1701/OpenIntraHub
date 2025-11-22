# Changelog

All notable changes to OpenIntraHub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5-alpha] - 2024-11-22

### Added - Enterprise Performance & Mobile Apps

#### Performance Optimizations (5000+ Users)
- **Database Pool Optimization** (`core/database.js`)
  - Increased max connections: 20 → 100
  - Connection health checks & warming
  - Batch insert support, slow query logging

- **Redis Service** (`core/redis.js`) - NEW
  - Caching for user profiles, conversations
  - Socket.io Redis Adapter for horizontal scaling
  - Online status tracking, rate limiting

- **Memory-Safe Middleware** (`core/middleware.js`)
  - Rate limiter with automatic cleanup
  - XSS protection, input sanitization
  - SQL injection protection

- **Database Indexes** (`db/migrations/017_performance_indexes.sql`)
  - 40+ performance indexes for all tables

#### Mobile Apps (React Native / Expo)
- Complete mobile app with Dashboard, Chat, Drive, Projects
- i18n (DE/EN), Socket.io, Zustand state management

#### Project Management
- Kanban Drag & Drop with optimistic updates
- Task modal with priority, due date, assignee

### Fixed
- **Critical**: `require('./db')` → `require('./database')` in 13 modules

### Security
- Helmet headers, XSS protection, rate limiting

---

## [Unreleased]

### Added - Exchange Integration Phase 2

#### Backend Services
- **Bidirectional Calendar Sync** (`core/exchangeService.js`)
  - `syncToExchange()` - Push OpenIntraHub events to Exchange Calendar
  - `syncBidirectional()` - Orchestrate two-way synchronization
  - `getOutOfOfficeSettings()` - Read OOF settings from Exchange
  - `setOutOfOfficeSettings()` - Configure OOF in Exchange
  - Conflict resolution for calendar events
  - Automatic retry logic for failed syncs

- **Scheduled Sync Worker** (`core/scheduledSyncWorker.js`)
  - Background worker for automatic Exchange synchronization
  - Configurable sync interval (default: 15 minutes)
  - Batch processing (max 50 users per cycle)
  - Overlap prevention with running syncs tracking
  - Automatic OOF expiration check (every 5 minutes)
  - Daily cleanup of old logs (30 days) and history (90 days)
  - Graceful shutdown support
  - Integrated into `core/app.js` with SIGTERM/SIGINT handlers

#### Global User Status System
- **User Status Service** (`core/userStatusService.js`)
  - Global presence management across all modules
  - 6 status types: `available`, `away`, `busy`, `dnd`, `offline`, `oof`
  - Status messages and custom text
  - Out of Office (OOF) management
  - Status history tracking for analytics
  - Automatic status expiration
  - Heartbeat mechanism (60s intervals)
  - Bulk status retrieval for performance
  - Online user tracking (active in last 5 minutes)

- **User Status API** (`core/userStatusApi.js`)
  - `GET /api/status/me` - Get own status
  - `PUT /api/status/me` - Update status & message
  - `POST /api/status/me/oof` - Set Out of Office
  - `GET /api/status/:userId` - Get user's public status
  - `POST /api/status/bulk` - Get multiple user statuses (max 100)
  - `GET /api/status/online` - List all online users
  - `GET /api/status/statistics` - Admin analytics
  - `POST /api/status/heartbeat` - Keep-alive endpoint

- **Database Migration 013** (`db/migrations/013_user_status_and_mail.sql`)
  - `user_status` table with OOF fields
  - `user_status_history` for analytics
  - `mail_folders`, `mail_messages`, `mail_attachments` tables
  - `mail_sync_queue` for pending operations
  - Triggers for automatic status tracking
  - Indexes for performance optimization

#### Mail System
- **Mail Service** (`core/mailService.js`)
  - `syncFolders()` - Sync Exchange mail folders
  - `syncMessages()` - Sync messages from folders
  - `syncAttachments()` - Download attachments metadata
  - `sendMail()` - Send email via Exchange
  - `markAsRead()` / `markAsUnread()` - Message state management
  - `deleteMessage()` - Delete with Exchange sync queue
  - `getFolders()`, `getMessages()`, `getMessage()` - Retrieval methods

- **Mail API** (`core/mailApi.js`)
  - `GET /api/mail/folders` - List user folders
  - `POST /api/mail/folders/sync` - Sync folders from Exchange
  - `GET /api/mail/messages` - List messages (with filters, search, pagination)
  - `GET /api/mail/messages/:id` - Get single message with attachments
  - `POST /api/mail/messages/sync` - Sync messages from Exchange
  - `POST /api/mail/send` - Send new email
  - `PUT /api/mail/messages/:id/read` - Mark as read/unread
  - `DELETE /api/mail/messages/:id` - Delete message
  - `GET /api/mail/unread-count` - Get unread count

### Added - Frontend Components

#### Chat UI Enhancements
- **User Status Integration** (`ChatList.jsx`, `ChatWindow.jsx`)
  - Status badges showing user availability
  - Colored status indicators (green=available, yellow=away, red=busy/dnd, purple=oof, gray=offline)
  - Status messages displayed in conversation list
  - OOF messages with vacation emoji and end date
  - Real-time status updates via Socket.io
  - Integration with `useUserStatus` hook

- **User Status Badge Component** (`components/UserStatusBadge.jsx`)
  - Reusable status indicator with 6 status types
  - Size variants: xs, sm, md, lg
  - Optional label display
  - Emoji support for special statuses (DND, OOF)
  - Tailwind CSS styling

- **User Status Hook** (`hooks/useUserStatus.js`)
  - React hook for status management
  - Bulk status loading for performance
  - Automatic heartbeat every 60 seconds
  - Status update functions
  - OOF management integration
  - Real-time status tracking for multiple users

#### Mail Client
- **Mail Inbox** (`pages/Mail/MailInbox.jsx`)
  - Full-featured email inbox with folder navigation
  - Search and filter (all/unread)
  - Folder sidebar with unread counts
  - Message list with sorting
  - Manual sync buttons for folders and messages
  - Responsive design with Tailwind CSS
  - Time ago display for messages
  - Attachment indicators

- **Mail Compose** (`pages/Mail/MailCompose.jsx`)
  - Rich email composition interface
  - Multiple recipient support (To, Cc)
  - Email validation
  - Tag-based recipient UI with remove functionality
  - Importance selection (Low, Normal, High)
  - Plain text and HTML body support
  - Send with loading states
  - Reply functionality (in progress)

- **Mail View** (`pages/Mail/MailView.jsx`)
  - Full message display with formatting
  - Sender information with avatar
  - Recipient display (To, Cc)
  - Importance indicators
  - Attachment list with size display
  - Action buttons (Reply, Mark Unread, Delete)
  - OOF message display for internal users
  - Responsive layout

#### Out of Office Management
- **OOF Settings Dashboard** (`pages/UserSettings/OOFSettings.jsx`)
  - Enable/disable OOF with toggle
  - Scheduled OOF with date/time pickers
  - Immediate or scheduled activation
  - Separate internal and external messages
  - Quick message templates (Vacation, Sick, Meeting)
  - Current status display with visual indicators
  - Exchange sync status indicator
  - Rich text message editors
  - Save with validation

#### Setup Wizard Enhancement
- **Module Selection Step** (`pages/Setup/Setup.jsx`)
  - New step 5: Module selection
  - Checkbox UI for each module
  - Module descriptions and benefits
  - "Recommended" badges for core modules
  - Exchange integration note for Events module
  - Visual module cards with hover effects
  - Module configuration stored in .env
  - Available modules:
    - Posts & Blog
    - Events & Calendar
    - Locations & Rooms
    - Chat & Messaging
    - Page Builder (Drag & Drop)

### Changed

- **App.js** - Integrated `mailApi` and `scheduledSyncWorker`
- **Setup Wizard** - Increased steps from 6 to 7 (added Module Selection)
- **Chat Components** - Replaced simple online indicators with rich status badges
- **Environment Variables** - Added `EXCHANGE_SYNC_INTERVAL_MINUTES`

### Technical Improvements

- **Security**: AES-256-GCM encryption for Exchange credentials
- **Performance**: Bulk status loading, indexed database queries
- **Reliability**: Retry logic for sync failures, graceful degradation
- **Scalability**: Batch processing for sync operations
- **Monitoring**: Comprehensive logging with Winston
- **Real-time**: WebSocket integration for status updates
- **Database**: Optimized indexes for mail and status queries
- **Error Handling**: Proper error messages and user feedback

### Database Changes

- Added `user_status` table with OOF support
- Added `user_status_history` for tracking
- Added `mail_folders` table
- Added `mail_messages` table with JSONB recipients
- Added `mail_attachments` table
- Added `mail_sync_queue` for async operations
- Created triggers for automatic status tracking
- Added indexes for performance optimization

---

## [0.1.1-alpha] - 2024-XX-XX

### Added - Exchange Integration Phase 1

- **Exchange Connection Management**
  - EWS (Exchange Web Services) integration via node-ews
  - Secure credential storage with AES-256-GCM encryption
  - Connection testing and validation
  - User-specific Exchange connections

- **Calendar Synchronization**
  - One-way sync from Exchange to OpenIntraHub
  - Automatic event creation and updates
  - Change detection via ChangeKey
  - Scheduled background sync
  - Next sync time tracking

- **Exchange API Endpoints**
  - Connection setup and testing
  - Calendar synchronization triggers
  - Connection status monitoring

### Added - Core Features (v0.1.0)

- Multi-authentication system (JWT, LDAP, Database)
- Role-Based Access Control (RBAC) with 5 roles
- 20+ granular permissions
- Internationalization (i18n) support for 7 languages
- Winston structured logging
- Swagger API documentation
- PostgreSQL database with migrations
- Event-driven architecture with Event Bus
- Modular plugin system
- Web-based Setup Wizard

### Added - Modules

- **Posts & Blog Module** - Content publishing with categories
- **Events & Calendar Module** - Event management
- **Locations Module** - Office and room management
- **Chat Module** - Real-time messaging (WebSocket)
- **Page Builder Module** - Drag & Drop page creation

---

## Version History

- **v0.1.1-alpha** - Exchange Phase 1 (Calendar Sync)
- **Unreleased** - Exchange Phase 2 (Mail, OOF, Status, UI)
- **Next** - Project Module, Advanced Permissions, Notifications

---

For more details, see the [README](README.md) and [API Documentation](http://localhost:3000/api-docs).
