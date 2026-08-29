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