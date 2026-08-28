# DealersOrbit Dashboard

Admin & Manager web dashboard for the DealersOrbit backend (`orbitads/backend`).
Vite + React + React Router. No component library — plain CSS matching the
marketing site's brand (navy `#0d1f3c` / orange `#f5a623`, Syne + DM Sans).

## Run (dev)

```bash
npm install
npm run dev          # http://localhost:5173
```

The backend must be running on `http://localhost:8000`
(`cd orbitads/backend && python3 -m uvicorn app.main:app --reload`).
Vite proxies `/api` → `localhost:8000`, so the browser talks same-origin (no CORS).

## Build

```bash
npm run build        # → dist/
```

For a hosted build set `VITE_API_BASE` (see `.env.example`) to the real API root.

## Auth & routing

- `AuthContext` (`src/auth.jsx`) holds the JWT (localStorage key `do_dash_token`)
  and the `/auth/me` user. On load it resolves a stored token before rendering.
- Two role-scoped route trees: `/admin/*` (role `admin`) and `/manager/*`
  (role `manager`). Wrong role → redirected to the user's own shell; no token
  → `/login`.

## Scope

**Part 5a (this build) — Admin Dashboard:**
- Dealerships — CRUD + assign-manager (email search)
- Users — filter/search/paginate, create user, grant plan
- Bulk Assign — paste emails → per-email assigned/not-found results
- Review Queue — dealer-platform approve / reject (reason) / assign-to-dealership
- Analytics — overview (success rate, format split, top voices) + API usage/costs,
  with a `since` date range + optional dealership filter

**Part 5b (next) — Manager Dashboard:** roster, per-salesperson drill-down,
leaderboard, vehicles posted/sold. `/manager` currently shows a placeholder.
