# Rosario Dairy System

An Integrated Inventory and Point-of-Sale (POS) System built for Rosario Dairy, featuring First-Expired, First-Out (FEFO) tracking, automated demand forecasting, and real-time transaction management.

---

## Key Features

- **Point-of-Sale (POS):** Fast checkout interface for staff, cart management, and automated receipt/payload handling.
- **Inventory & FEFO Management:** Expiry tracking and automated First-Expired, First-Out prioritization to reduce dairy spoilage.
- **Order & Sales Tracking:** Real-time transaction history, order fulfillment, and status monitoring.
- **Customer & User Management:** Role-based access control (Admin vs. Staff) for securing administrative tasks.
- **Reports & Analytics:** Sales reports, best-seller tracking, and data-driven demand insights.

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **State & Routing:** Context API, React Router
- **Backend Transport:** Axios / REST API (Django Backend)
- **Icons & UI:** Lucide React

---

## Project Structure

This application follows a **Domain-First (Feature-Based) Architecture** to ensure high code colocation, clean maintainability, and scalability.

```text
src/
├── app/          # Root application setup, role layouts, and primary navigation
├── components/   # Global domain-neutral UI primitives (buttons, modals, badges)
├── features/     # Business domains (inventory, pos, orders, customers, sales, reports)
├── lib/          # HTTP transport (Axios), error handling, and API helpers
└── styles/       # Design tokens, global CSS, and theme configuration
```

## Local development

The backend repository is expected beside this one at `../SarimaHoes`.
With PostgreSQL running and the backend virtual environment installed, start Django:

```bash
cd ../SarimaHoes
venv/bin/python manage.py migrate
venv/bin/python manage.py runserver 127.0.0.1:8000
```

In another terminal, from this frontend directory:

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and sign in with a Django account. On a fresh
database, create the first admin with `venv/bin/python manage.py createsuperuser`
from the backend directory. Staff accounts can then be created in User Management.

API calls use `/backend` on the frontend origin. Vite forwards them to
`http://127.0.0.1:8000`, preserving Django's existing API paths and avoiding
cross-origin configuration for local development. No `.env` is required for these
defaults. Copy `.env.example` to `.env` to override `API_PROXY_TARGET` (the Django
server address) or `VITE_API_BASE_URL` (the browser's API base URL).

```bash
npm test          # API service contract tests
npm run build     # Production bundle
npm run preview   # Preview at http://127.0.0.1:4173 with the same API proxy
```

For deployment, configure the web server to forward `/backend/*` to Django with
the `/backend` prefix removed, or set `VITE_API_BASE_URL` to the deployed API
origin before building and allow the frontend origin in Django's CORS settings.
