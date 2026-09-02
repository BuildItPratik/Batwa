# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-01

### Added
- **Admin Dashboard**: Live transaction feed with auto-refresh (5s).
- **Admin Authentication**: `POST /admin/auth` issues bearer tokens verified via PIN.
- **Admin Statistics**: `GET /admin/stats` for real-time aggregation of balances and card counts.
- **Payment Receipts**: Print-friendly layout on merchant success screen.
- **Voice Prompts**: Static pre-recorded mp3 prompts for EN, HI, TA, MR.
- **Full Translation**: Runtime API translation for the UI with English fallback.
- **Warm-up Script**: Python script to mitigate Render free-tier cold starts.
- **Documentation Hub**: Split large README into `API_REFERENCE.md` and `DEPLOYMENT_GUIDE.md` with enterprise-grade repository guidelines.

### Changed
- **Frontend Architecture**: Migrated entire frontend to React 19, TypeScript, Vite 8, and React Router 7.
- **Package Manager**: Switched frontend from npm to pnpm.
- **Database Backend**: SQLite updated to use WAL journal mode and `BEGIN IMMEDIATE` for atomic transaction isolation.
- **API Models**: Separated `customer_id` and `card_id` concepts in API payloads to allow card reissue without data loss.

### Fixed
- **QR Service**: Fixed `qrcode.image.pil` import bug blocking customer registration.
- **SPA Routing**: Replaced hard anchor tags `<a>` with React Router `<Link>` components to fix white-screen bugs on deployment. Added `vercel.json` rewrites.
