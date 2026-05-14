# JRSPC Admin Frontend

React + Vite + Tailwind admin shell aligned with the modular Node backend.

## Stack
- React
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Tailwind CSS

## Run
```bash
npm install
npm run dev
```

## Environment
Create `.env` from `.env.example`.

`VITE_API_BASE_URL` must point to a reachable backend API (otherwise form submits can appear “stuck” until the request fails/times out).
