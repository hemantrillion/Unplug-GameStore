# UNPLUG distribution decisions

## User requirement

HeKuGo is an additional first-party distribution channel: two homepage cards lead to Android APK and desktop download pages. Google Play and the browser-installed PWA remain part of the product direction. Both clients use one hosted platform, reconnect when connectivity is available, and preserve the specified offline behavior.

## Repositories

- `hemantrillion/hekugo.online`: discovery and download pages.
- `hemantrillion/Unplug-GameStore`: proposed home for the shared platform, API contracts, web player and Android client.
- `hemantrillion/Unplug-Desktop`: proposed home for the desktop packaging and workspace integration.

Share versioned API/SDK contracts rather than maintaining incompatible copies of backend rules in the two apps. Repository responsibilities are proposed; neither new remote contained source during this review.

## Website changes

`hekugo.online/` in this workspace is a separate checkout of the existing website repository. Its homepage has two new cards, with pages at `/unplug-android/` and `/unplug-desktop/`, shared styles and an SVG icon. These changes are local and have not been published.

Download controls are disabled because no actual application release exists. Do not point visitors to imaginary APK/installer files. Windows is the provisional first desktop target; macOS/Linux packages require their own builds and verification.

## Release distribution

Use public GitHub Release assets for the APK and Windows installer, linked from HeKuGo. Use immutable version-specific release URLs, with version, size, minimum OS, architecture, release notes, and SHA-256 published together. Attach the release assets before enabling the corresponding download link. The website release edit should be verified against the uploaded files. Update the homepage's Coming soon labels at that time.

A release pipeline should build and test the client, sign the final installer/APK, compute its checksum, publish the binary and release metadata, then prepare the matching website update. A checksum does not replace publisher signing. Game artifact releases have their separate admin-review and activation pipeline.

## Shared connectivity

The static website and GitHub repositories do not run the API/database/build workers. Provision an HTTPS backend, persistent database, artifact storage, and isolated build service. Both clients must use the same production environment and account system. Example subdomain choices require DNS and hosting setup before being used as application endpoints.

Networking should include startup/resume refresh, bounded retries, timeouts, explicit offline/stale states, and retry-safe operations. Do not interrupt a running game with a newly activated release. Offline play applies to verified downloaded offline games, not submissions, payments, multiplayer, or immediate remote revocation.

## Packaging and updates

- Android: choose the permanent application ID and release signing key before distributing the first APK. Plan signing compatibility with Play App Signing before Play enrollment; an upload key is not necessarily the app-signing key. Increment versionCode and test upgrade-in-place with user data retained. Direct APK updates require an appropriate user-mediated install flow.
- Desktop: choose Windows package type, supported versions/architectures, publisher signing and verified updater or manual update flow. A downloaded installer must not require users to install Node or configure a local backend. Untrusted games must not inherit native shell privileges.
- PWA: provide a hosted workspace URL and browser installation flow; a webmanifest is metadata, not a downloadable executable. Keep shell updates separate from game updates.
- Distinguish client versions, API/SDK compatibility versions, immutable game release versions and deployment revisions. Database migrations and local save compatibility require upgrade tests.

## Outstanding inputs

Hosting/budget, permanent application IDs, signing arrangements, supported desktop targets, and provider accounts remain to be settled. Commercial/legal inputs from the instruction PDF also remain applicable. HeKuGo distribution does not replace those requirements.
