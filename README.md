# MYTH — UI Preview (Not a real wallet)

**MYTH** is the standalone app planned for the MYTHCHAIN + ZYRA ecosystem. This repository distributes **UI preview builds only** for design/usability testing, starting with Windows.

## Status
- Windows: native installable **desktop UI preview v0.1.0** (PySide6 / Qt WebEngine shell around the approved interactive MYTH interface); available via GitHub Releases.
- Linux/macOS desktop: not yet compiled.
- Android: **UI preview APK v0.1.4 is available** (Android 7.0+). Includes read-only network status and verified in-app APK update downloads. Timed update polling has been removed; background event-driven FCM alerts are NOT live until Firebase is configured. No real pairing, server telemetry, wallet signing or transactions. Windows stays v0.1.0.
- iOS: not built, **no IPA/TestFlight build**.

## Android preview (sideload APK)
1. Download `MYTH-Android-UI-Preview-v0.1.4.apk` from [the Android v0.1.4 preview release](https://github.com/annabil-dev/MYTH-app/releases/tag/ui-preview-v0.1.4).
2. Verify its SHA-256: `e7df0466618fc82decb3e725c143e8ef5d0652927cd68577a15266add2d284aa`.
3. Open APK using Files/Downloads; allow installation from that source when Android asks, install, and open MYTH. Revoke install-unknown-apps permission afterward if not needed.
4. App package `io.mythchain.myth.preview`, version `0.1.4-ui-preview`. Android 7.0+ (API24), target SDK35. Requests INTERNET for public read-only chain status, version manifest, and user-initiated verified APK downloads; REQUEST_INSTALL_PACKAGES for system-approved installation and POST_NOTIFICATIONS for future FCM notifications. On newer-version prompt, download and verification happen inside MYTH, installation requires Android user confirmation. Background push delivery is not configured yet; no wallet signing, secrets, broadcast or device pairing. This preview has a dedicated signing key, not a production wallet key.

## IMPORTANT SECURITY NOTICE
UI-only sample data. No private key storage, no seed recovery, no RPC wallet signing, no blockchain transaction, no ZYRA Miner pairing, no validator control. Never enter actual passphrases, recovery phrases or financial data into preview.

This is **NOT** the MYTHCHAIN full-node client. Official MYTHCHAIN **node v0.2.6 remains unchanged**, distributed separately by annabil-dev/ON-CHAIN-VALIDATOR. No v0.2.7 node release is involved.

## Windows desktop preview — graphical setup installer
**Recommended for new users:** Download `MYTH-Setup-Windows-UI-Preview-v0.1.0.exe` from [the official preview release](https://github.com/annabil-dev/MYTH-app/releases/tag/ui-preview-v0.1.0), verify its optional SHA-256 checksum, then double-click to start the Windows installer wizard. Choose the install location, optionally add a desktop shortcut, and click Install. The small Setup.exe downloads the official 218 MB portable ZIP over HTTPS and verifies a pinned checksum before extracting it. For offline use, put the verified official ZIP in the same folder as Setup.exe. Start MYTH from the Start Menu or uninstall from Windows Installed Apps. It installs only for the current user and does not need administrator rights.

SHA-256 of small online Setup.exe: `9c32acc33521bfa1d5da24107ed81d408ce64c345f618e71124d56a52a093588`. Internet is necessary during setup unless the matching official release ZIP is placed beside Setup.exe; Qt/WebEngine files are validated and extracted automatically.

**Alternative:** Download `MYTH-Desktop-Windows-UI-Preview-v0.1.0.zip`, verify its checksum, extract the whole folder including `_internal`, then launch `MYTH\MYTH.exe`. The PowerShell installer is also provided as an optional legacy alternative.

This UI-only experimental preview is not signed with a trusted Windows code-signing certificate. Windows SmartScreen may show an Unverified Publisher warning. There is no auto-update mechanism in this prototype; only use the project's release links.

## Website
Official documentation and supported download status: https://mythchain.pages.dev/docs/wallet

## Application roadmap
Cross-platform UI (Windows/Linux/macOS, Android, iOS), read-only chain access, secure wallet vault, transaction signing, secure device pairing (validator and ZYRA Miner), ZYRA task view. None of these functional milestones should be assumed complete from an UI preview.

## License
No license grant is implied by public artifact distribution. Contact the project owner before redistributing or modifying source.
