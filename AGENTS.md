# AGENTS.md - Public Release Guide

## Purpose
This repository is a public demo release. Keep all changes safe for publication and avoid adding private/internal operational details.

## Working Rules
- Use TypeScript/Next.js conventions already used in this project.
- Prefer project APIs (for example, `/api/files`) over direct filesystem access from UI code.
- Keep user-facing text in Japanese unless a task explicitly asks for another language.
- Before finalizing, run at least `npm run lint`.

## Security Rules
- Do not commit secrets, private keys, or internal network information.
- Keep demo authentication data clearly marked as sample-only.
- Ensure uploaded file handling keeps existing validation and sanitization behavior.

## Primary Paths
- `src/app/` : pages and API routes
- `src/lib/` : core data and business logic
- `public/data_demo/` : public demo data
- `doc/` : public-facing documentation

## Final Checklist
- [ ] No internal-only file paths or company-private references remain
- [ ] Documentation matches current behavior
- [ ] Lint passes (warnings acceptable if previously known)
- [ ] Git diff includes only intended public-release changes
