# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

## [Unreleased]

### Changed

- Catalog cover in Melimelo's colors: deep green, cream, coral and yellow, Gabarito title.

## [1.0.1] - 2026-11-11

- Maintenance release, no functional change.

## [1.0.0] - 2026-11-11

### Added

- Melimelo cloud integration, started from the official Gladys JavaScript integration
  template: configured with the Melimelo API URL and a personal access token (secret).
- A **household** device: open tasks, overdue tasks, shopping list items, today's events, next
  bin collection (days and name), next birthday (days and name).
- Scene triggers: a task is due today, bins go out tomorrow, it is someone's birthday, an item
  is added to the shopping list, a calendar event is about to start.
- Scene actions: add to the shopping list, create a task, complete a task, synchronize now.
- **Melimelo household** dashboard widget, with an "Add to shopping" form.
- Configuration buttons: test the connection, synchronize now.
- English, French, German and Spanish for the configuration screen, messages, widget and
  documentation.
- CI (format, lint, tests on Node 22 and 24, store checks, Docker build), UI-driven release,
  multi-arch image, GitHub releases and Dependabot, as in gladys-devmel.

[Unreleased]: https://github.com/prohand/gladys-melimelo/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/prohand/gladys-melimelo/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/prohand/gladys-melimelo/releases/tag/v1.0.0
