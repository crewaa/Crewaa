# Crewaa Mobile App

React Native mobile client for **Crewaa** built with **Expo SDK 57**, **TypeScript**, **Expo Router**, and **NativeWind v4** (Tailwind CSS).

The mobile app shares the same backend (FastAPI), domain models, and the dark-only **Royal Peacock** theme as the web frontend.

---

## Tech Stack

- **Framework:** Expo SDK 57 (React Native 0.86, React 19)
- **Routing:** Expo Router v57 (File-based routing)
- **Styling:** NativeWind v4 + Tailwind CSS (Royal Peacock palette)
- **Icons:** `lucide-react-native` + `react-native-svg`
- **Data Fetching:** `@tanstack/react-query`
- **Networking:** Axios with single-flight silent refresh & `expo-secure-store`
- **Haptics:** `expo-haptics`
- **Navigation:** `@react-navigation/native`

---

## Design System: Royal Peacock Theme (Dark Only)

| Token | Hex | Usage |
|---|---|---|
| `peacock-bg` | `#071A1F` | Screen background |
| `peacock-deep` | `#04121A` | Bottom tab bar, modals |
| `peacock-surface` | `#0D252B` | Cards, input fields |
| `peacock-raised` | `#12303A` | Elevated cards, dialogs |
| `peacock-line` | `#1C3B43` | Borders, dividers |
| `peacock-text` | `#EAF4F3` | Primary body text |
| `peacock-muted` | `#8FB0B0` | Placeholders, inactive labels |
| `peacock-teal` | `#26BDB0` | Primary CTA, active icons |
| `peacock-on-teal` | `#03201C` | Text inside solid teal buttons |
| `peacock-gold` | `#D8B45A` | Badges, secondary accents |
| `peacock-blue` | `#4FB3D9` | Links, secondary highlights |
| `peacock-ok` | `#86D36B` | Success / High fit |
| `peacock-warn` | `#F29A4A` | Warnings / Medium fit |
| `peacock-danger` | `#F2716B` | Errors / Declined |

---

## Getting Started

### 1. Install dependencies
```bash
cd mobile
npm install
```

### 2. Environment Variables
Create a `.env` file in the `mobile` directory:
```bash
# Point to your local FastAPI backend or remote server
# Use your computer's local IP (e.g. http://192.168.1.50:8000) when testing on a physical device
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start Development Server
```bash
npm start
```
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan the QR code with **Expo Go** on a physical phone
