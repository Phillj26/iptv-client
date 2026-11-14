# Desktop shell

The desktop app packages the Streamline PWA with Tauri for Windows, macOS, and Linux where Tauri supports the target. The shell does not add a server or a credential proxy; playlists remain local to the device.

## Prerequisites

Install Rust and the platform dependencies required by Tauri, then run:

```bash
pnpm install
pnpm desktop:dev
```

Use `pnpm --filter @streamline/desktop build` to create a distributable package after testing the web build and player behavior on the target platform.
