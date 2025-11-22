# Changelog

All notable changes to OpenIntraHub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.3-alpha] - 2025-11-22

### Added - CI/CD Pipeline

#### GitHub Actions Workflows
- **CI Pipeline** (`.github/workflows/ci.yml`)
  - Backend tests with Jest (Node.js 18)
  - Frontend tests with Vitest
  - PostgreSQL service container for integration tests
  - Build verification for frontend
  - Security audit for dependencies
  - Docker build test
  - Coverage report artifacts

- **Release Pipeline** (`.github/workflows/release.yml`)
  - Automatic GitHub releases on version tags
  - Docker image build and push to GHCR
  - Release archive generation
  - Pre-release detection for alpha/beta versions

- **Dependabot Configuration** (`.github/dependabot.yml`)
  - Weekly dependency updates
  - Grouped updates for React, Vite, testing libraries
  - GitHub Actions version updates
  - Docker base image updates

### Added - Test Coverage Expansion

#### Backend Tests (Jest)
- **Database Module Tests** (`tests/unit/database.test.js`)
  - Connection lifecycle testing
  - Query execution tests
  - Error handling verification
  - Configuration validation

- **Social Service Tests** (`tests/unit/socialService.test.js`)
  - Post/comment reactions (6 types)
  - Activity feed operations
  - Notifications management
  - Mentions parsing (@username)
  - User social statistics

- **Chat Service Tests** (`tests/unit/chatService.test.js`)
  - Direct and group conversations
  - Message send/edit/delete
  - Participant management
  - Read status tracking
  - Message search functionality

### Added - Performance Optimizations

#### Caching System (`core/cacheService.js`)
- **Memory Cache (LRU)**
  - Configurable max size and TTL
  - Automatic cleanup of expired entries
  - LRU eviction for memory management
  - Pattern-based cache invalidation

- **Redis Cache Support**
  - Automatic Redis detection via environment
  - Fallback to memory cache
  - Prefix-based key isolation
  - TTL support for all operations

- **Cache Middleware**
  - Route-level response caching
  - X-Cache header (HIT/MISS)
  - Conditional caching support
  - Async memoization helper

#### Performance Utilities (`core/performanceUtils.js`)
- **Query Optimization**
  - Cursor-based pagination builder
  - Selective column queries
  - Batch processing utilities

- **Rate Limiting**
  - In-memory rate limiter
  - Configurable windows and limits
  - Middleware for route protection
  - Retry-After header support

- **Performance Monitoring**
  - Execution time measurement
  - Timer with lap functionality
  - Debounce and throttle helpers

- **Response Optimization**
  - Null value cleanup
  - Pagination metadata wrapper
  - Compression configuration

### Test Statistics
- **Total Tests: 207**
  - Backend (Jest): 169 tests
  - Frontend (Vitest): 38 tests
- **Coverage Target: 50%** for branches, functions, lines, statements

---

## [0.1.1-alpha] - 2025-11-21

### Added - Project Management Module

#### Backend
- **Project Service** (`core/projectService.js`)
  - Full project CRUD operations
  - Status tracking (active, on_hold, completed, archived)
  - Team member management
  - Progress percentage calculation
  - Drive folder integration per project

- **Kanban Board System**
  - Board creation and management per project
  - Customizable columns (backlog, todo, in_progress, review, done)
  - WIP (Work in Progress) limits per column
  - Column color customization

- **Task/Issue Management**
  - Task types: task, bug, feature, epic, story
  - Priority levels: low, medium, high, critical
  - Assignee and reporter tracking
  - Due dates and time estimation
  - Task comments and activity tracking
  - Task dependencies (blocks, blocked_by, related_to)

- **Database Migration 016** (`db/migrations/016_project_management.sql`)
  - `projects` table with comprehensive fields
  - `project_boards` table for Kanban boards
  - `board_columns` table with WIP limits
  - `tasks` table with full task management
  - `task_comments` and `task_dependencies` tables
  - Full-text search indexes
  - Automatic timestamp triggers

#### Frontend
- **Project List Page** (`pages/Projects/ProjectList.jsx`)
  - Project overview with status indicators
  - Progress bars and team avatars
  - Quick actions (edit, archive)

- **Kanban Board View** (`pages/Projects/ProjectKanban.jsx`)
  - Drag & Drop task management
  - Column-based task organization
  - Task detail modals
  - Quick task creation

### Added - Drive System (File Management)

#### Backend
- **Drive Service** (`core/driveService.js`)
  - Folder hierarchy management
  - File upload with chunked support
  - File versioning and rollback
  - File deduplication via SHA256 hash
  - Visibility controls (private, shared, public)
  - Storage quota management per user
  - Share link generation with expiration
  - Download tracking and statistics

- **Drive API** (`core/driveApi.js`)
  - `GET/POST /api/drive/folders` - Folder management
  - `GET/POST /api/drive/files` - File operations
  - `GET /api/drive/files/:id/download` - File download
  - `GET /api/drive/files/:id/versions` - Version history
  - `GET /api/drive/stats` - Storage statistics
  - `GET /api/drive/public/:token` - Public file access

- **Database Migration 015** (`db/migrations/015_drive_system.sql`)
  - `drive_folders` table with path and depth tracking
  - `drive_files` table with deduplication support
  - `drive_file_versions` for version history
  - `drive_shares` for sharing functionality
  - `drive_access_logs` for tracking
  - Full-text search on file/folder names

#### Frontend
- **Drive Page** (`pages/Drive/Drive.jsx`)
  - File browser with folder navigation
  - Drag & Drop file upload
  - File preview modal
  - Context menu actions
  - Breadcrumb navigation

- **Drive Advanced** (`pages/Drive/DriveAdvanced.jsx`)
  - Version history viewer
  - Storage quota display
  - Batch operations
  - Advanced search

### Added - LDAP Admin Panel

#### Frontend
- **LDAP Admin Page** (`pages/Admin/LDAPAdmin.jsx`)
  - LDAP connection status display
  - User synchronization controls
  - Group mapping configuration
  - Sync logs viewer
  - Manual sync trigger

- **Routing Update** - Added LDAP Admin to frontend routes

### Added - Exchange Integration Phase 2

#### Backend Services
- **Bidirectional Calendar Sync** (`core/exchangeService.js`)
  - `syncToExchange()` - Push OpenIntraHub events to Exchange
  - `syncBidirectional()` - Two-way synchronization
  - `getOutOfOfficeSettings()` - Read OOF from Exchange
  - `setOutOfOfficeSettings()` - Configure OOF in Exchange
  - Conflict resolution for calendar events
  - Automatic retry logic for failed syncs

- **Scheduled Sync Worker** (`core/scheduledSyncWorker.js`)
  - Background worker for automatic Exchange sync
  - Configurable interval (default: 15 minutes)
  - Batch processing (max 50 users per cycle)
  - Overlap prevention
  - Automatic OOF expiration check (every 5 minutes)
  - Daily cleanup of old logs (30 days) and history (90 days)
  - Graceful shutdown support

#### Global User Status System
- **User Status Service** (`core/userStatusService.js`)
  - 6 status types: `available`, `away`, `busy`, `dnd`, `offline`, `oof`
  - Status messages and custom text
  - Out of Office (OOF) management
  - Status history tracking for analytics
  - Automatic status expiration
  - Heartbeat mechanism (60s intervals)
  - Bulk status retrieval
  - Online user tracking

- **User Status API** (`core/userStatusApi.js`)
  - `GET /api/status/me` - Get own status
  - `PUT /api/status/me` - Update status
  - `POST /api/status/me/oof` - Set Out of Office
  - `GET /api/status/:userId` - Get user status
  - `POST /api/status/bulk` - Bulk status query (max 100)
  - `GET /api/status/online` - Online users list
  - `GET /api/status/statistics` - Admin analytics

- **Database Migration 013** (`db/migrations/013_user_status_and_mail.sql`)
  - `user_status` table with OOF fields
  - `user_status_history` for analytics
  - Mail system tables

#### Mail System
- **Mail Service** (`core/mailService.js`)
  - `syncFolders()` - Sync Exchange mail folders
  - `syncMessages()` - Sync messages from folders
  - `sendMail()` - Send email via Exchange
  - `markAsRead()` / `markAsUnread()` - Message state
  - `deleteMessage()` - Delete with sync queue
  - Attachment handling

- **Mail API** (`core/mailApi.js`)
  - `GET /api/mail/folders` - List folders
  - `POST /api/mail/folders/sync` - Sync folders
  - `GET /api/mail/messages` - List messages
  - `GET /api/mail/messages/:id` - Get message
  - `POST /api/mail/send` - Send email
  - `PUT /api/mail/messages/:id/read` - Mark read/unread
  - `DELETE /api/mail/messages/:id` - Delete message
  - `GET /api/mail/unread-count` - Unread count

### Added - Frontend Components

#### Chat UI Enhancements
- **User Status Integration** in Chat components
  - Status badges showing availability
  - Colored indicators (green, yellow, red, purple, gray)
  - OOF messages with vacation emoji
  - Real-time status updates

- **User Status Badge Component** (`components/UserStatusBadge.jsx`)
  - Reusable status indicator
  - Size variants: xs, sm, md, lg
  - Optional label display

- **User Status Hook** (`hooks/useUserStatus.js`)
  - React hook for status management
  - Bulk status loading
  - Automatic heartbeat

#### Mail Client
- **Mail Inbox** (`pages/Mail/MailInbox.jsx`)
  - Full inbox with folder navigation
  - Search and filter capabilities
  - Unread counts per folder
  - Manual sync buttons

- **Mail Compose** (`pages/Mail/MailCompose.jsx`)
  - Rich composition interface
  - Multiple recipients (To, Cc)
  - Importance selection
  - Tag-based recipient UI

- **Mail View** (`pages/Mail/MailView.jsx`)
  - Full message display
  - Attachment list
  - Action buttons (Reply, Delete)

#### Out of Office Management
- **OOF Settings** (`pages/UserSettings/OOFSettings.jsx`)
  - Enable/disable toggle
  - Scheduled OOF with date pickers
  - Separate internal/external messages
  - Quick templates

#### Setup Wizard Enhancement
- **Module Selection Step** - New step 5 in setup wizard
  - Checkbox UI for each module
  - Module descriptions
  - "Recommended" badges

### Changed
- **App.js** - Integrated mailApi, projectApi, and scheduledSyncWorker
- **Setup Wizard** - Increased to 7 steps (added Module Selection)
- **Chat Components** - Rich status badges instead of simple indicators
- **Environment Variables** - Added Drive and Project configuration

### Technical Improvements
- **Security**: AES-256-GCM encryption for Exchange credentials
- **Performance**: Bulk operations, optimized indexes
- **Reliability**: Retry logic, graceful degradation
- **Scalability**: Batch processing for sync operations
- **Real-time**: WebSocket integration for status updates

### Database Changes
- Added `projects`, `project_boards`, `board_columns`, `tasks` tables
- Added `drive_folders`, `drive_files`, `drive_file_versions` tables
- Added `drive_shares`, `drive_access_logs` tables
- Added `user_status`, `user_status_history` tables
- Added `mail_folders`, `mail_messages`, `mail_attachments` tables
- Created comprehensive indexes for performance
- Added full-text search capabilities

---

## [0.1.0-alpha] - 2024-XX-XX

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

- **Exchange API Endpoints**
  - Connection setup and testing
  - Calendar synchronization triggers
  - Connection status monitoring

### Added - Core Features

- **Authentication System**
  - Multi-authentication (JWT, LDAP, Database)
  - Role-Based Access Control (RBAC) with 5 roles
  - 20+ granular permissions
  - Session tracking with audit log

- **Internationalization**
  - i18next support for 7 languages (DE, EN, FR, ES, IT, PL, NL)
  - Automatic language detection
  - Module-specific translations

- **Infrastructure**
  - Winston structured JSON logging
  - Swagger/OpenAPI documentation
  - PostgreSQL with migration system
  - Event-driven architecture (Event Bus)
  - Modular plugin system

- **Web Setup Wizard**
  - 7-step installation process
  - Database configuration
  - LDAP/Exchange setup
  - Admin user creation

### Added - Modules

- **Posts & Blog Module**
  - Rich-text content publishing
  - Categories and tags
  - SEO-friendly slugs
  - Draft/Published status

- **Events & Calendar Module**
  - Event management with calendar view
  - Participant management with RSVP
  - Event series (recurrence)
  - Alarms and notifications

- **Locations & Rooms Module**
  - Office location management
  - Room booking system
  - Resource management
  - User assignment

- **Chat Module**
  - Real-time messaging (Socket.io)
  - Direct and group chats
  - File sharing
  - Typing indicators
  - Read receipts

- **Page Builder Module**
  - Drag & Drop visual editor
  - Module types: Text, Image, Heading, Posts
  - Live preview
  - Responsive design

- **Social Feed Module**
  - Activity feed
  - Emoji reactions
  - Comments with nesting

---

## Version History

| Version | Status | Description |
|---------|--------|-------------|
| 0.1.1-alpha | Current | Project Management, Drive, LDAP Admin, Exchange Phase 2 |
| 0.1.0-alpha | Released | Core System, Basic Modules, Exchange Phase 1 |

---

## Upcoming

### v0.2.0 (Planned)
- Unit & Integration Tests
- CI/CD Pipeline (GitHub Actions)
- Performance Optimizations
- Advanced Admin Dashboard
- Notification Center

### v0.3.0 (Future)
- Wiki Module
- Workflows & Approvals
- Advanced Analytics
- Mobile App (React Native)

---

For more details, see the [README](README.md) and [API Documentation](http://localhost:3000/api-docs).
