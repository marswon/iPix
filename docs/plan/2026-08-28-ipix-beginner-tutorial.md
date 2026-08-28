# iPix Beginner Tutorial Plan

Date: 2026-08-28
Branch: `codex/gettoken-seedance-v021`

## Goal

Turn the existing quickstart into a zero-background tutorial for the current iPix GetToken release. A reader should install the app, connect one GetToken credential, generate an image, edit it with a reference image, and create a Seedance 2.0 video without reading developer documentation.

## Outputs

- `docs/quickstart.md`: complete Chinese Markdown tutorial.
- `marketing/quickstart.html`: visual web edition using the existing approved marketing shell.
- Real current-product screenshots under `marketing/assets/guide/`.
- Static contract coverage for release links, core steps, screenshots, and troubleshooting.

## User Journey

1. Download and install `v0.21.0-gettoken.5` on Apple Silicon macOS or Windows x64.
2. Create the first local project.
3. Add a GetToken connection and verify `qwen-image-2.0-pro` plus Seedance 2.0 availability.
4. Generate a first image.
5. Add a reference image and complete a real Qwen Pro image edit.
6. Use a generated or uploaded image as the first frame for Seedance 2.0.
7. Find running/completed work in the task center and recover from common errors.

## Boundaries

- Keep internal protocol names, bundle IDs, environment variables, and historical data paths unchanged.
- Do not claim Intel macOS support for the `.5` prerelease.
- Do not expose provider credentials, signed URLs, task IDs, or account details in screenshots or copy.
- Do not describe model verification as proof that every upstream request will always succeed.

## Acceptance

- Markdown and HTML contain the same ordered user journey and current release URLs.
- Screenshots show current iPix branding and no credentials.
- Desktop/web walkthrough verifies readable headings, valid image assets, no horizontal overflow, and working anchors at desktop and mobile widths.
- Site checks, tutorial static checks, secrets check, and diff check pass.
