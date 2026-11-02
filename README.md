# Minds Digital Legacy (MDL)

MDL's public website uses plain HTML, CSS and browser ES modules, served by Express. The backend is organized into routes, controllers, validation, authentication middleware, database configuration and query models. MySQL remains the source of truth for registrations, requests, internship applications and published opportunities.

## Project Structure

```text
MDL/
├── .env.example
├── .gitignore
├── database.sql                       # Additive MySQL schema
├── database/
│   └── migrations/
│       └── 001_admin_dashboard.sql    # Additive dashboard tables
├── package-lock.json
├── package.json
├── README.md
├── server.js                          # Environment setup and HTTP listener
├── server/
│   ├── app.js                         # Express middleware and route composition
│   ├── config/
│   │   └── database.js                # Shared MySQL pool
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── adminOperationsController.js
│   │   ├── internshipController.js
│   │   ├── registrationController.js
│   │   └── requestController.js
│   ├── middleware/
│   │   └── adminAuth.js               # Login, database sessions, CSRF and role guards
│   ├── models/
│   │   ├── adminModel.js
│   │   ├── adminOperationsModel.js
│   │   ├── clientIdentity.js
│   │   ├── internshipModel.js
│   │   ├── registrationModel.js
│   │   └── requestModel.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── announcementRoutes.js
│   │   ├── corporateTrainingRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── internshipRoutes.js
│   │   ├── registrationRoutes.js
│   │   └── serviceRoutes.js
│   ├── tests/
│   │   └── app.test.js                # Built-in Node route/contract tests
│   └── validation/
│       └── values.js                  # Shared allowed values and validators
└── public/
    ├── index.html                     # Company overview page
    ├── admin.html                     # Independent protected management UI
    ├── privacy.html
    ├── mdl-logo.png
    ├── components/
    │   ├── corporate-training-form.html
    │   ├── internship-form.html
    │   ├── registration-form.html
    │   ├── service-request-form.html
    │   ├── site-footer.html
    │   └── site-header.html
    ├── data/
    │   ├── courses.js
    │   ├── sectors.js
    │   └── services.js
    ├── js/
    │   ├── api.js
    │   ├── site-shell.js
    │   ├── admin/
    │   │   ├── api.js
    │   │   ├── applications.js
    │   │   ├── auth.js
    │   │   ├── main.js
    │   │   └── opportunities.js
    │   ├── forms/
    │   │   ├── mount.js
    │   │   ├── registration.js
    │   │   └── request-form.js
    │   └── pages/
    │       ├── academy.js
    │       ├── internships.js
    │       ├── sectors.js
    │       └── services.js
    ├── pages/
    │   ├── about.html
    │   ├── academy.html
    │   ├── careers.html
    │   ├── contact.html
    │   ├── corporate-training.html
    │   ├── internships.html
    │   ├── sectors.html
    │   └── services.html
    ├── styles.css                     # CSS module entry point
    └── styles/
        ├── admin.css
        ├── base.css
        ├── components.css
        ├── forms.css
        ├── layout.css
        ├── pages.css
        ├── responsive.css
        └── tokens.css
```

## Run Locally

1. Install Node.js 18+ and start MySQL (for example, through XAMPP).
2. Back up the `mdl_registration` database before applying schema changes. For a fresh database, import `database.sql`. For an existing installation, import `database/migrations/001_admin_dashboard.sql` into `mdl_registration` before deploying the updated server. It adds dashboard tables, backfills CRM links for existing service and corporate-training requests, and does not drop or rewrite the original request records.
3. Copy `.env.example` to `.env` and set database credentials.
4. Generate a one-time bootstrap token in PowerShell:
   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
   Put the result in `.env` as `ADMIN_SETUP_TOKEN`, then restart the server.
5. Run:
   ```bash
   npm install
   npm start
   ```
6. Visit `http://localhost:3000/admin.html`, choose **Set up the first administrator**, and enter the token and administrator account details. The first account receives the Super Admin role. Remove `ADMIN_SETUP_TOKEN` from `.env` and restart the server immediately after setup.

Passwords are hashed with Node's scrypt before storage. Admin sessions use random opaque tokens stored only as digests in MySQL, HTTP-only `SameSite=Strict` cookies, an eight-hour expiry, same-origin checks, and per-session CSRF tokens. Bootstrap is restricted by the environment token and a database-locked one-time setup guard. Keep `.env` private and use HTTPS in production.

Development and verification commands:

```bash
npm run dev
npm test
```

## Responsibilities and Contracts

- Public page URLs are served from `public/pages/`; the root remains the company overview.
- Shared navigation/footer and form markup are HTML fragments in `public/components/`.
- Each page imports only its own renderer and/or form handler. Form handlers share `public/js/api.js` and keep existing field names and endpoint contracts.
- Static service, sector and course content lives in `public/data/`. Internship opportunities are fetched from the database, not seeded in frontend data.
- API paths remain `/api/registrations`, `/api/service-requests`, `/api/corporate-training-requests`, `/api/internship-opportunities`, `/api/internship-applications`, and `/api/admin/*`.
- Database access is parameterized and isolated in models. The existing registration table/schema and endpoint have been preserved.
- The admin dashboard uses the existing registration, service, corporate training and internship tables; management-only status, assignment, note and financial fields live in additive tables. Published database courses and homepage announcements are served through public read-only APIs.
- Student records, courses, internship opportunities/applications, service requests, corporate training, client profiles, date-filtered reports, announcement publishing, staff accounts, roles and audit history have administrator screens and protected APIs. Staff access is limited to assigned records and restricted status/note updates.
- Shared MDL tokens are defined in `public/styles/tokens.css`; `public/styles.css` imports the layout, component, form, page, admin and responsive modules.

## Current Boundaries

- Internship document uploads and email notifications are not implemented. Applicants are told not to submit sensitive documents; establish private storage, file validation, and an authorized download endpoint before requesting CVs or school letters.
- Website content management currently covers homepage announcements and published courses. Service/sector copy and company contact settings remain in the existing static public pages.
- Financial fields distinguish estimates, proposals, and agreed values; there is no payment ledger, so reports do not claim actual revenue.
- CSV reports are capped at 10,000 rows and explicitly mark truncated exports; narrow the date range for large datasets.
- The privacy notice is an initial template. Add MDL's verified contact details and confirm lawful basis, retention and handling with Rwanda's current data-protection requirements before production use.
- No internship openings are seeded. Only administrator-published opportunities appear; applications of interest do not guarantee placement.
- Database migration is manual and must be applied only after a verified backup. This workspace has no configured `.env` or database connection, so the migration and live workflows were not run here.
- Use HTTPS, a dedicated least-privilege database user, backups, monitoring, and production-grade rate limiting before deployment.
