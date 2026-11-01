@AGENTS.md

# Chi Tiêu — notes for Claude

Personal expense app (Vietnamese users). Android APK via EAS, iPhone via the web build (PWA) on
Cloudflare. The user writes in Vietnamese: reply in Vietnamese.

## Stack

Expo SDK 58, React Native 0.88 (Hermes, React Compiler), Expo Router (`src/app`, typed routes),
expo-sqlite (web: wa-sqlite + OPFS, needs COOP/COEP headers), TypeScript, Jest (jest-expo,
node:sqlite adapter in `src/db/__testutils__`).

| Where | What |
|---|---|
| `src/db` | schema + migrations (`PRAGMA user_version`), repo, backup (JSON), CSV import |
| `src/i18n` | `vi.ts` is the source; `en/ko/zh/ja.ts` must match it (type-checked). `strings()` outside components, `useStrings()` inside |
| `src/lib` | pure helpers: money (integer đồng), dates (`YYYY-MM-DD` strings), receipt parser |
| `src/receipts` | screenshot scan: `ocr.ts` (native ML Kit module), `ocr.web.ts` (Tesseract from CDN) |
| `modules/chitieu-text-recognition` | local Expo module (Kotlin) around ML Kit, with R8 keep rules |
| `public/` | web shell: `index.html` (PWA meta, keyboard/viewport script), `sw.js`, `_headers`, manifest |
| `scripts/` | `deploy-web.sh`, `finish-web-export.js` (sw precache list), `serve-web.js` (local, same headers) |

## Rules

- Before saying done: `.claude/skills/release/scripts/check.sh` (tsc + lint + jest, prints only problems).
- No prettier (no config; it rewrites quotes). Style: single quotes, 2 spaces, ~120 columns,
  `bracketSameLine` JSX. Edit by hand.
- Every UI string goes into `src/i18n/vi.ts` and all four other languages. Never hard-code text.
  Built-in category/wallet names are stored in Vietnamese and shown via `categoryLabel`/`walletLabel`.
- Import icons as `@expo/vector-icons/Ionicons` (the barrel import adds ~4 MB of fonts to the web build).
- Forms scroll with `KeyboardAwareScrollView` (not KeyboardAvoidingView).
- Real transfer screenshots in `~/Pictures/anh-chuyen-khoan/` have real names and account numbers:
  never copy them into the repo; tests use made-up names.
- Commit as `-c user.name="tung" -c user.email="tunglehoctot@gmail.com"`; push to `origin master`.

## Shipping

`/release` (skill, scripts in `.claude/skills/release/scripts/`) does it all: checks → version bump → commit → web deploy → EAS APK →
emulator test → link. **Never give the user an APK link that hasn't passed the emulator test**
(skills `test-android`, `test-web`). Send only the newest tested link and say its version.

## Saving tokens

- Prefer the skills' scripts: they print summaries, not logs.
- Read files with offset/limit or grep; read UI as text (`ui.sh dump`) before taking screenshots.
- Pipe noisy commands (`sdkmanager`, `eas`, `expo export`, `dexdump`) through `tail`/`grep`.
- One feature per session; long sessions get expensive.
