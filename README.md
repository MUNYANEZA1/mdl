# Minds Digital Legacy (MDL)

MDL's public website uses plain HTML, CSS and browser ES modules, served by Express. The backend is organized into routes, controllers, validation, authentication middleware, database configuration and query models. MySQL remains the source of truth for registrations, requests, internship applications and published opportunities.

## Project Structure

```text
MDL/
├── .env.example
├── .gitignore
├── database.sql                       # Additive MySQL schema
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
│   │   ├── internshipController.js
│   │   ├── registrationController.js
│   │   └── requestController.js
│   ├── middleware/
│   │   └── adminAuth.js               # Login, signed cookie and access guard
│   ├── models/
│   │   ├── adminModel.js
│   │   ├── internshipModel.js
│   │   ├── registrationModel.js
│   │   └── requestModel.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── corporateTrainingRoutes.js
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
2. Import `database.sql` in phpMyAdmin or run it with the MySQL client. The statements create missing tables and do not drop existing registrations.
3. Copy `.env.example` to `.env` and set database credentials.
4. Configure admin access with `ADMIN_USERNAME`, a random `MDL_ADMIN_SECRET`, and `ADMIN_PASSWORD_HASH`. Generate the scrypt hash with Node:
   ```js
   const crypto = require('node:crypto');
   const salt = crypto.randomBytes(16).toString('hex');
   const hash = crypto.scryptSync('your-long-unique-password', salt, 64).toString('hex');
   console.log(`${salt}:${hash}`);
   ```
   Store `salt:hash` in `.env`, not the password. Admin access stays disabled until all three variables are configured.
5. Run:
   ```bash
   npm install
   npm start
   ```
6. Visit `http://localhost:3000`. Admin UI: `/admin.html`.

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
- Shared MDL tokens are defined in `public/styles/tokens.css`; `public/styles.css` imports the layout, component, form, page, admin and responsive modules.

## Current Boundaries

- Admin UI manages internship opportunities and internship application status/internal notes. It does not yet manage course catalogs, service categories, corporate/service request queues, or summary statistics.
- Internship file uploads are not implemented. Applicants are told not to submit sensitive documents; establish protected storage and upload validation before requesting CVs or school letters.
- The privacy notice is an initial template. Add MDL's verified contact details and confirm lawful basis, retention and handling with Rwanda's current data-protection requirements before production use.
- No internship openings are seeded. Only administrator-published opportunities appear; applications of interest do not guarantee placement.
- Use HTTPS, a dedicated least-privilege database user, backups, monitoring and production-grade rate limiting/CSRF protections before deployment.
