# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.0.2] - 2026-04-02

### Added

- Core: BaseRecognizer state machine (Idle, Possible, Recognized, Failed, Began, Changed, Ended, Cancelled)
- Core: Manager for binding recognizers to elements and routing pointer events
- Core: PointerTracker with velocity computation and multi-touch geometry
- Core: Arbitrator for failure dependencies, simultaneous recognition, and priority
- TapRecognizer with configurable threshold, interval, and multi-pointer rejection
- Convenience API: `tap(el, callback)` with automatic cleanup and manager reuse
- Subpath exports: `fngr`, `fngr/tap`, `fngr/base`
- VitePress documentation site with Gruvbox theme and interactive demos
- Unit tests (144 tests, vitest + jsdom)
- E2E tests (18 tests x 3 browsers, Playwright)
- Mutation testing (Stryker, 94.35% score)

## [0.0.1] - 2026-04-01

- Name reservation
