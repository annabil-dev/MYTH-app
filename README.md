# MYTH — UI Preview (Not a real wallet)

**MYTH** is the standalone app planned for the MYTHCHAIN + ZYRA ecosystem. This repository distributes **UI preview builds only** for design/usability testing, starting with Windows.

## Status
- Windows: native installable **desktop UI preview v0.1.0** (PySide6 / Qt WebEngine shell around the approved interactive MYTH interface); available via GitHub Releases.
- Linux/macOS desktop: not yet compiled.
- Android: **UI preview APK v0.1.0 is now available** (Android 7.0+); signed APK, local static UI, no internet permission, no actual wallet features.
- iOS: not built, **no IPA/TestFlight build**.

## Android preview (sideload APK)
1. Download `MYTH-Android-UI-Preview-v0.1.0.apk` from [the official preview release](https://github.com/annabil-dev/MYTH-app/releases/tag/ui-preview-v0.1.0).
2. Verify its SHA-256: `207227228bfe2902e6cfd8765c80676e37315f1afef93abc7a4e6f2eed1e3086`.
3. Open APK using Files/Downloads; allow installation from that source when Android asks, install, and open MYTH. Revoke install-unknown-apps permission afterward if not needed.
4. App package `io.mythchain.myth.preview`, version `0.1.0-ui-preview`. Android 7.0+ (API24), target SDK35. Offline demo, no internet permission, no seed phrase, no RPC. This preview has a dedicated signing key, not a production wallet key.

## IMPORTANT SECURITY NOTICE
UI-only sample data. No private key storage, no seed recovery, no RPC wallet signing, no blockchain transaction, no ZYRA Miner pairing, no validator control. Never enter actual passphrases, recovery phrases or financial data into preview.

This is **NOT** the MYTHCHAIN full-node client. Official MYTHCHAIN **node v0.2.6 remains unchanged**, distributed separately by annabil-dev/ON-CHAIN-VALIDATOR. No v0.2.7 node release is involved.

## Windows desktop preview
1. Download the ZIP and SHA-256 checksum from [the preview release](https://github.com/annabil-dev/MYTH-app/releases/tag/ui-preview-v0.1.0).
2. Verify the checksum before extracting.
3. Extract the entire ZIP, including `_internal`.
4. Run `MYTH\MYTH.exe`.
5. Optionally download the PowerShell installer from the same release, review it, and run locally. The installer checks the pinned archive SHA-256, installs to the current user's AppData, and creates a Start Menu shortcut; no admin rights needed.

Windows SmartScreen might warn because this experimental preview is not code-signed. There is no auto-update mechanism in this prototype. Do not install it on a machine where you cannot evaluate these risks.

## Website
Official documentation and supported download status: https://mythchain.pages.dev/docs/wallet

## Application roadmap
Cross-platform UI (Windows/Linux/macOS, Android, iOS), read-only chain access, secure wallet vault, transaction signing, secure device pairing (validator and ZYRA Miner), ZYRA task view. None of these functional milestones should be assumed complete from an UI preview.

## License
No license grant is implied by public artifact distribution. Contact the project owner before redistributing or modifying source.
