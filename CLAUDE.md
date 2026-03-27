# CLAUDE.md — Pulse Codebase Guide

Pulse is an intent-driven geosocial networking app for gay, bi, trans, and queer men, featuring AI-powered semantic matching. It is a React/TypeScript SPA backed by Google Firebase (Auth + Firestore) and the Google Gemini API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 with TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 (via `@tailwindcss/vite` plugin) |
| Routing | React Router DOM 7 |
| Backend/dev server | Express 4 + Vite middleware (`server.ts`) |
| Auth & Database | Firebase 12 (Authentication + Firestore) |
| AI | Google Gemini API (`@google/genai`) |
| Maps | Leaflet + react-leaflet, leaflet.heat for heatmaps |
| Icons | lucide-react |
| Animations | motion |
| Utilities | clsx, tailwind-merge (`cn()`), date-fns |

---

## Project Structure

```
pulse/
├── src/
│   ├── pages/           # Full-page route components
│   │   ├── Login.tsx
│   │   ├── SignUp.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── Onboarding.tsx   # Profile creation wizard
│   │   ├── Grid.tsx         # Main discovery view (grid + map)
│   │   ├── ChatList.tsx     # Conversations list
│   │   ├── Chat.tsx         # Individual chat view
│   │   └── Profile.tsx      # Own profile management
│   ├── components/
│   │   ├── Layout.tsx       # Bottom nav + Outlet wrapper
│   │   └── ProtectedRoute.tsx  # Auth + onboarding gate
│   ├── contexts/
│   │   └── AuthContext.tsx  # Global auth state via useAuth()
│   ├── lib/
│   │   └── utils.ts         # cn() className helper
│   ├── App.tsx              # Router configuration
│   ├── main.tsx             # React DOM mount
│   ├── firebase.ts          # Firebase app init, exports db and auth
│   └── index.css            # Tailwind base import
├── server.ts                # Express server (dev: Vite middleware, prod: static)
├── vite.config.ts           # Vite config with path alias and env injection
├── tsconfig.json            # TypeScript config (no emit, bundler resolution)
├── firestore.rules          # Firestore security rules
├── firebase-applet-config.json  # Firebase project credentials (committed)
├── firebase-blueprint.json  # Firestore schema reference
├── .env.example             # Required environment variables
└── metadata.json            # App metadata and permission declarations
```

---

## Development Workflow

### Prerequisites
- Node.js (LTS recommended)
- A `.env` file with `GEMINI_API_KEY` set (copy from `.env.example`)

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000 (Express + Vite HMR)
npm run build        # Production build → dist/
npm run preview      # Preview the production build
npm run clean        # Remove dist/
npm run lint         # TypeScript type-check (tsc --noEmit), no compilation
```

### Development Server

`npm run dev` runs `server.ts` via `tsx`. The Express server:
- In development: mounts Vite as middleware (full HMR)
- In production: serves static files from `dist/` with SPA fallback
- Always listens on port **3000** (`0.0.0.0`)
- Exposes `GET /api/health` → `{ status: "ok" }`

### Environment Variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required. Injected at build time by Vite into `process.env.GEMINI_API_KEY` |
| `APP_URL` | Deployment URL (informational, not consumed at runtime) |
| `DISABLE_HMR` | Set to `"true"` to disable Vite HMR (used by AI Studio to prevent flicker) |

`GEMINI_API_KEY` is injected at Vite build time via `define` in `vite.config.ts` — it is **not** available via `import.meta.env`, only via `process.env.GEMINI_API_KEY`.

---

## Routing & Authentication

Routes are declared in `src/App.tsx`. All main routes are wrapped in `<ProtectedRoute>`, which:
1. Redirects unauthenticated users to `/login`
2. Redirects authenticated users without a public profile to `/onboarding`

| Path | Component | Access |
|---|---|---|
| `/login` | Login | Public |
| `/signup` | SignUp | Public |
| `/forgot-password` | ForgotPassword | Public |
| `/onboarding` | Onboarding | Public (redirects if profile exists) |
| `/` | Grid | Protected + Layout |
| `/chats` | ChatList | Protected + Layout |
| `/profile` | Profile | Protected + Layout |
| `/chat/:chatId` | Chat | Protected (no Layout nav) |

`<Layout>` renders a sticky bottom navigation bar for the three main tabs.

---

## Firebase / Firestore

### Initialization

`src/firebase.ts` initializes the Firebase app from `firebase-applet-config.json` and exports:
- `db` — Firestore instance (uses a named database from `firestoreDatabaseId`)
- `auth` — Firebase Auth instance

### Firestore Data Model

```
/users/{uid}
  uid, email, role ("user"|"admin"), isVerified

/public_profiles/{uid}
  uid, displayName, photoURL, age (≥18), height, weight,
  sexualRole, tribes[], bio (≤500), tags[], intent (≤50),
  lat, lng, lastActive, livePulseExpiresAt,
  isGhostMode, broadcast (≤200), broadcastExpiresAt, isVerified

/chats/{chatId}
  participants[uid, uid], lastMessage, updatedAt, unreadCount{}

/chats/{chatId}/messages/{messageId}
  senderId, text (≤1000), timestamp, isRead,
  mediaUrl, isNSFW, isViewOnce, viewedAt
```

### Security Rules Summary (`firestore.rules`)

- `/users/{uid}` — owner-only read/write
- `/public_profiles/{uid}` — any authenticated user can read; owner-only write
- `/chats/{chatId}` — participants only (checked via `request.auth.uid in resource.data.participants`)
- `/chats/{chatId}/messages/{messageId}` — participants can read/create; sender can update/delete
- All writes are validated by strict field-level Firestore functions (`isValidUser`, `isValidPublicProfile`, `isValidChat`, `isValidMessage`)

### Real-time Data Pattern

Components use Firestore `onSnapshot` listeners for live updates. Always unsubscribe in `useEffect` cleanup:

```ts
useEffect(() => {
  const unsub = onSnapshot(query, (snap) => { /* ... */ });
  return () => unsub();
}, []);
```

---

## Auth Context

`src/contexts/AuthContext.tsx` provides global auth state. Access it in any component via:

```ts
import { useAuth } from '../contexts/AuthContext';
const { user, loading } = useAuth();
```

The context wraps the app with Firebase `onAuthStateChanged` and exposes the current Firebase `User` (or `null`) and a loading flag.

---

## Styling Conventions

- **Color scheme**: Dark theme — `zinc-950` backgrounds, `rose-500` primary accent
- **Utility helper**: Use `cn()` from `src/lib/utils.ts` (wraps `clsx` + `tailwind-merge`) for conditional class names
- **Tailwind CSS 4**: Loaded via the `@tailwindcss/vite` plugin — no separate `tailwind.config.js` needed
- **No CSS modules**: All styling is Tailwind utility classes inline

---

## Naming Conventions

- **Files/Components**: PascalCase (`Grid.tsx`, `AuthContext.tsx`)
- **Functions/variables**: camelCase
- **Interfaces/Types**: Descriptive PascalCase (e.g., `Profile`, `Message`, `AuthContextType`)
- **Path alias**: `@/` maps to the project root (e.g., `@/src/lib/utils`)

---

## No Test Framework

There are no automated tests in this project. `npm run lint` runs TypeScript type-checking only (`tsc --noEmit`). Always run this before committing to catch type errors.

---

## Key Features to Understand

- **AI Semantic Search**: Natural language profile search via Gemini API
- **Vibe Match**: AI-calculated compatibility scores between user profiles
- **Live Pulse**: Broadcast status with 1-hour TTL (`livePulseExpiresAt` timestamp)
- **Ghost Mode**: `isGhostMode: true` hides a profile from discovery
- **View-Once Messages**: `isViewOnce: true` messages that expire after being read (`viewedAt` set on read)
- **Geospatial**: Profiles store `lat`/`lng`; Grid page has grid and map views with Leaflet heatmaps
- **Verified Badges**: `isVerified` field on both `/users` and `/public_profiles`

---

## Important Constraints

- **Age enforcement**: Firestore rules reject profiles with `age < 18`
- **Field limits enforced in Firestore rules**: bio ≤ 500 chars, bio tags ≤ 20, tribes ≤ 10, displayName ≤ 50, intent ≤ 50, text messages ≤ 1000
- **`firebase-applet-config.json` is committed** — this is intentional for AI Studio; do not remove it
- **Do not modify `DISABLE_HMR` logic** in `vite.config.ts` — it prevents flickering during AI-assisted edits
- **ESM throughout**: `package.json` has `"type": "module"`; all imports use ES module syntax
