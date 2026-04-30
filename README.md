# Stocker

Stocker is a Node.js/Express brokerage-style dashboard with EJS views, user accounts, deposits, withdrawals, KYC flows, package subscriptions, copy-trader screens, and an admin panel.

## Requirements

- Node.js 20 or newer
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from the example:

   ```bash
   cp .env.example .env
   ```

3. Update the values in `.env`, especially `SESSION_SECRET` and `MAIL_PASS`.

4. Start the app:

   ```bash
   npm start
   ```

The app runs on `http://localhost:3000` by default.

## Scripts

- `npm start` starts the Express server.
- `npm run check` validates `server.js` syntax.
- `npm test` runs syntax checks and the Node test suite.

## Project Structure

- `server.js` configures Express, middleware, route mounting, startup checks, and background jobs.
- `routes/` contains public, auth, user, and admin route handlers.
- `services/` contains mail, JSON storage, and user helpers.
- `middleware/` contains auth, CSRF, and upload middleware.
- `config/` contains shared runtime/security configuration.
- `views/admin/` contains admin dashboard templates.
- `views/user/` contains signed-in user dashboard templates.
- `views/` contains public, auth, and legal templates.
- `test/` contains route/template and CSRF regression tests.

## Runtime Notes

- JSON data files are created under `database/` and `data/` when the server starts.
- Uploaded files are stored under `public/uploads/`.
- If no admin exists, the server creates an `admin` user whose password is set on first login.
- Admin pages are limited to localhost plus the comma-separated IPs in `ADMIN_IPS`.
- Keep `.env` private. Configure production environment variables in your hosting provider dashboard.
