# iPix Intel macOS 12.7 Release Plan

Date: 2026-08-28
Branch: `codex/gettoken-seedance-v021`
Target release: `v0.21.0-gettoken.6`

## Goal

Produce and publish an Intel x64 iPix Preview DMG that runs on an i5 Mac with macOS 12.7, while retaining the Apple Silicon macOS and Windows x64 packages in the same immutable prerelease.

## Compatibility Evidence

- Project Electron version: `43.4.1`.
- Bundled Electron `LSMinimumSystemVersion`: `12.0`; macOS 12.7 satisfies the runtime floor.
- `scripts/packaging/platform-binaries.cjs` supports `darwin-x64` for both ffmpeg and ffprobe.
- Existing Electron Builder configuration already defines macOS x64 targets; the preview workflow currently invokes only arm64.

## Workflow Change

- Add an independent `mac-intel-preview` job on an Intel GitHub macOS runner.
- Build `iPix.Preview-mac-x64.dmg` with `electron-builder --mac dmg --x64`.
- Run packaged MCP smoke against the derived `iPix Preview.app` path on the Intel runner.
- Require Apple Silicon, Intel macOS, and Windows jobs before publication.
- Compare all three resolved checkout SHAs.
- Stage exactly two DMGs and one EXE on an invisible draft; verify exact architecture-specific names and asset count before publication.

## Acceptance

- Workflow contract tests cover three-source SHA equality, two DMGs plus one EXE, exact arm64/x64 asset names, and Intel packaged smoke.
- Full repository gates pass before push.
- GitHub Actions completes Apple Silicon, Intel macOS, Windows, and draft publication jobs.
- Release target SHA equals the pushed commit.
- Release metadata exposes uploaded, non-empty Apple Silicon DMG, Intel x64 DMG, and Windows EXE with GitHub SHA-256 digests.

## Residual Hardware Boundary

CI can verify the x64 binary natively on an Intel runner and confirm the macOS deployment target. Final performance and GPU behavior on the user's specific i5 model still require one launch on that physical Mac; this release must not claim hardware-specific performance before that check.
