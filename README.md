# Uniflow

Uniflow is a React Native daily-life companion built with Expo SDK 54 and TypeScript. It includes a dashboard, habits, tasks, news, nearby places, meditation, calendar access, authentication, offline storage, and optional Supabase sync.

Repository: https://github.com/surajvast1/wake-up-app

## 1. Requirements

Install Node.js 20+, Yarn Classic 1.x, and Expo Go on your phone. Android Studio is required for Android emulators/native builds; Xcode is required for iOS simulators/native builds. Expo CLI does not need to be installed globally because this project uses `npx expo`.

Check your versions:

```bash
node --version
yarn --version
```

## 2. Clone the project

```bash
git clone https://github.com/surajvast1/wake-up-app.git
cd wake-up-app
```

If it is already downloaded:

```bash
cd /path/to/wake-up-app
```

## 3. Install dependencies

This repository uses Yarn and includes `yarn.lock`:

```bash
yarn install
```

If Yarn is missing:

```bash
npm install --global yarn
yarn install
```

Use Yarn consistently instead of repeatedly mixing `npm install` and `yarn install`.

## 4. Configure environment variables

Create your local environment file:

```bash
cp .env.example .env
```

Open `.env` and fill in the values you have:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WHEATHER_API_KEY=
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=
EXPO_PUBLIC_AQICN_TOKEN=
EXPO_PUBLIC_OPENROUTER_API_KEY=
EXPO_PUBLIC_OPENAI_API_KEY=
```

| Variable | Use |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase authentication and cloud sync |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key |
| `EXPO_PUBLIC_GOOGLE_WHEATHER_API_KEY` | Weather and Google services |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Nearby places |
| `EXPO_PUBLIC_AQICN_TOKEN` | AQICN/WAQI air-quality data |
| `EXPO_PUBLIC_OPENROUTER_API_KEY` | AI-generated daily quotes |
| `EXPO_PUBLIC_OPENAI_API_KEY` | Optional task suggestions |

Guest mode and local storage can work without Supabase. Weather, nearby places, air quality, news, and AI features need their corresponding keys.

Expo embeds every `EXPO_PUBLIC_*` value into the app bundle. Restart Metro after editing `.env`. Never commit `.env` or put private server keys in public Expo variables.

## 5. Start the app in Expo Go

The recommended command is:

```bash
cd /path/to/wake-up-app
yarn install
npx expo start --lan --clear --go
```

- `--lan` connects your phone and computer over the local network.
- `--clear` clears the Metro cache.
- `--go` creates an Expo Go-compatible link.

When the QR code appears:

1. Open Expo Go on your phone.
2. Scan the QR code in the terminal or Expo developer page.
3. Keep the terminal running.
4. Press `r` in the terminal to reload.

Your phone and computer must be on the same Wi-Fi. Disable a VPN temporarily if the phone cannot connect.

If scanning does nothing, get the Mac's LAN IP:

```bash
ipconfig getifaddr en0
```

Open Expo Go and enter:

```text
exp://YOUR_MAC_IP:8081
```

For example:

```text
exp://192.168.0.2:8081
```

If Expo Go is unavailable, install it from the App Store or Google Play and use a version that supports SDK 54.

## 6. Available commands

```bash
yarn start              # Start Expo in LAN mode
yarn start:lan          # Start Expo in LAN mode
yarn start:dev-client   # Start for a custom development client
yarn android            # Run native Android
yarn ios                # Run native iOS
yarn web                # Run Expo web
npx tsc --noEmit        # TypeScript check
```

For normal Expo Go development, use:

```bash
npx expo start --lan --clear --go
```

## 7. Expo Go and development builds

Expo Go is enough for normal JavaScript development. The project also has native Google Mobile Ads configuration. If a feature needs a native module not included in Expo Go, create a development build:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile development
npx expo start --dev-client
```

Install the generated development APK before using `yarn start:dev-client`.

## 8. Supabase setup

1. Create or open a Supabase project.
2. Add its URL and anonymous key to `.env`.
3. Open the Supabase SQL Editor.
4. Run `supabase-schema.sql`.
5. Run `supabase-patch-routine-rls.sql` if required.
6. Restart Expo.

Without Supabase, use guest mode for local/offline testing.

## 9. Device permissions

The app may request location, calendar, camera/photo-library, and notification permissions. Accept the prompts during testing. If a permission was denied, enable it from the phone's app settings.

## 10. Troubleshooting

### QR code does not scan

- Confirm the phone and computer are on the same Wi-Fi.
- Disable VPN, mobile-data switching, or restrictive guest Wi-Fi.
- Restart with `npx expo start --lan --clear --go`.
- Manually enter `exp://YOUR_MAC_IP:8081` in Expo Go.
- Confirm port 8081 is not blocked by the firewall.

### Old code is still showing

Stop Expo and restart:

```bash
npx expo start --lan --clear --go
```

Then press `r` or reload from Expo Go.

### Dependency versions are wrong

```bash
yarn install
npx expo install --check
```

This project must remain on Expo SDK 54. Do not upgrade individual Expo packages to SDK 55 versions.

### Environment values are missing

- The file must be named exactly `.env`.
- Variables must start with `EXPO_PUBLIC_`.
- Restart Metro after editing `.env`.
- Never print or commit API keys.

### Native build fails

```bash
npx expo-doctor
npx expo install --check
```

For Android, check Android Studio, the Android SDK, and an emulator/USB device. For iOS, check Xcode and CocoaPods.

## 11. EAS builds

```bash
npx eas-cli login
npx eas-cli whoami
```

Installable Android APK:

```bash
npx eas-cli build --platform android --profile apk
```

Google Play Android App Bundle:

```bash
npx eas-cli build --platform android --profile production
```

iOS build:

```bash
npx eas-cli build --platform ios --profile production
```

EAS cloud builds do not automatically use your local `.env`. Add required variables in the Expo project dashboard.

## 12. Project structure

```text
App.tsx                 Root app and navigation
index.ts                Expo entry point
app.json                Expo permissions and native configuration
eas.json                EAS build profiles
.env.example            Environment variable template
supabase-schema.sql     Supabase database schema
src/contexts            Auth, theme, and UI preferences
src/components          Shared UI components
src/hooks               Reusable React hooks
src/lib                 Shared utilities and integrations
src/services            API, storage, and data services
src/screens             App screens
assets                  Icons, splash assets, and animations
```

## 13. Final run command

After installing dependencies and configuring `.env`:

```bash
npx expo start --lan --clear --go
```

## License

This project does not currently include a license file.

