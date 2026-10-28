# Campus Complaint and Grievance Management System

CampusCare is a beginner-friendly full-stack college project that lets students submit campus complaints, track their status, and read administration responses. Administrators can view all submissions, update their status, and record progress notes.

## 1. Problem statement

Campus concerns such as maintenance problems, hostel issues, cafeteria concerns, internet failures, and academic grievances can be difficult to report and follow up on when there is no central system. CampusCare provides a single portal with complaint reference numbers, status tracking, and a record of administrative updates.

## 2. Objectives

- Provide students with a simple, central place to submit complaints.
- Give each complaint a reference number and status.
- Let students see only their own complaints.
- Give administrators a dashboard to review all complaints and document responses.
- Keep complaint records in a PostgreSQL database.
- Demonstrate authentication, REST APIs, database relationships, validation, and role-based access.

## 3. Roles and features

### Student
- Register and sign in.
- Submit a complaint with category, location, priority, title, and description.
- See personal complaint history and status counts.
- Search complaints and filter by status.
- View complaint activity and administration messages.

### Administrator
- Sign in using an administrator account created by the project owner.
- View all complaints and student names/emails.
- Search and filter complaints.
- Update status and add a required progress message.

### MVP limitations
- No file attachments, email/SMS notifications, anonymous submissions, password reset, or multi-admin assignment workflow.
- This is an academic demonstration, not an emergency reporting channel.
- Authentication is implemented by Express with bcrypt password hashes and an HTTP-only JWT cookie. For production use, consider a professionally managed identity provider, account recovery, audit logging, and a formal security review.

## 4. Technology stack

- Frontend: HTML5, CSS3, vanilla JavaScript
- Backend: Node.js and Express.js
- Database: Supabase PostgreSQL
- Security/support packages: `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `helmet`, `express-rate-limit`, `dotenv`, `@supabase/supabase-js`
- Version control: Git and GitHub

## 5. Folder structure

```text
campus-complaint-grievance-management-system/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── complaints.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── validation.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

Your real local `backend/.env` file is created during setup and intentionally is not included in Git.

## 6. Prerequisites

Install these on Windows:
- Visual Studio Code: https://code.visualstudio.com/
- Node.js LTS (includes npm): https://nodejs.org/
- Git: https://git-scm.com/downloads
- A free Supabase account: https://supabase.com/

Verify Node.js and npm in a new terminal:
```bash
node --version
npm --version
git --version
```
Use Node.js 20 or newer.

## 7. Set up Supabase

1. Sign in at https://supabase.com/ and create a new project.
2. Choose a project name and database password. Keep the database password private.
3. Wait until the database is ready.
4. Open **SQL Editor** in the Supabase dashboard.
5. Open this project's `database/schema.sql`, copy the entire file into a new SQL query, and click **Run**.
6. In **Table Editor**, verify that `profiles`, `complaints`, and `complaint_updates` exist.
7. Open **Project Settings → API** (or the project's API settings page). Copy the Project URL and the server-side `service_role` key. Supabase may label privileged keys as secret keys in newer dashboard versions. Use only a server-side privileged key for this specific backend.

**Never put the service-role/secret key in `frontend/`, never commit it, and never share it.** The backend performs authorization checks. RLS is enabled, but the service-role key bypasses RLS, so route-level authorization is essential.

## 8. Configure environment variables

Open a terminal in the project root, then:
```bash
cd backend
copy .env.example .env
```
On macOS/Linux use `cp .env.example .env`.

Open `backend/.env` and replace:
- `SUPABASE_URL`: your Supabase Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the privileged server-side key from your own project.
- `JWT_SECRET`: a long random secret. Generate one from the `backend/` directory with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  Copy the output into `.env`. Do not use the example text as a real secret.
- `PORT=3000` is the local web server port.
- `NODE_ENV=development` is for local development. Use `production` only when deployed over HTTPS.

`backend/.env.example` contains variable names and safe placeholders; `.env` contains your private local values. Keep `.env` out of Git.

## 9. Install dependencies and run

From the project root:
```bash
cd backend
npm install
npm run check
npm start
```
Expected server output:
```text
CampusCare is running at http://localhost:3000
```
Open **http://localhost:3000** in your browser. Do not open `frontend/index.html` directly; the Express server serves the frontend and its `/api` requests.

To restart automatically during development, use `npm run dev`.

## 10. Create the first administrator

Public registration always creates a `student` account. To create an administrator, first register an account through the app, then use the Supabase SQL Editor to promote that account. Replace the example email with the exact email you registered:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

Verify the change in the Table Editor or by running:
```sql
select full_name, email, role from public.profiles;
```
Sign out and sign back in after changing a role so the new token is issued with the updated role. Do not let students run this SQL or expose database credentials.

## 11. Architecture

1. The browser displays HTML/CSS and uses vanilla JavaScript `fetch()` calls.
2. Express validates requests and checks the HTTP-only JWT cookie.
3. The backend retrieves the current profile and enforces student/admin permissions.
4. The server-only Supabase client reads/writes PostgreSQL tables.
5. Complaint updates are stored as a history so students can follow progress.

The browser never connects to Supabase directly and never receives the privileged database key.

## 12. REST API

All responses are JSON. Private routes require a valid session cookie.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Check API availability | Public |
| POST | `/api/auth/register` | Create student account | Public; rate-limited |
| POST | `/api/auth/login` | Sign in | Public; rate-limited |
| GET | `/api/auth/me` | Get current user | Signed in |
| POST | `/api/auth/logout` | Clear session cookie | Public |
| GET | `/api/complaints` | List complaints | Student: own; admin: all |
| POST | `/api/complaints` | Submit complaint | Student or admin account |
| GET | `/api/complaints/:id` | Get details and updates | Owner or admin |
| PATCH | `/api/complaints/:id/status` | Change status and add update | Admin only |

### Request examples

Register:
```json
{
  "fullName": "A Student",
  "email": "student@example.edu",
  "studentId": "24CS012",
  "password": "a-long-demo-password"
}
```

Submit complaint:
```json
{
  "title": "Wi-Fi unavailable in library",
  "category": "IT & Internet",
  "location": "Central library, first floor",
  "priority": "Normal",
  "description": "The campus Wi-Fi has been unavailable in this area since this morning."
}
```

Admin status update:
```json
{
  "status": "In Progress",
  "message": "The IT team has been informed and is checking the access point."
}
```

Typical errors include `400` for invalid input, `401` for missing/invalid login, `403` for an unauthorized action, `404` for a missing record, `409` for duplicate account data, and `500` for an unexpected server/database error.

## 13. Manual testing checklist

1. Open `/api/health`; expect `{"status":"ok","service":"CampusCare API"}`.
2. Register a student; expect a student dashboard.
3. Sign out and sign in with the same credentials.
4. Try registering the same email again; expect a duplicate-account error.
5. Submit a complaint with a valid description; expect it to appear in the list.
6. Try submitting a too-short title or description; the browser and server should reject it.
7. Open complaint details; expect description, reference number, and activity history.
8. Register a second student; confirm the second student cannot see the first student's complaints.
9. Promote a test account to admin using the SQL above, then sign in again.
10. As admin, verify all complaints are visible and searchable.
11. Try managing a complaint as a student; the API should return `403`.
12. As admin, change a status and enter a message; the status and timeline should update.
13. Refresh the page; data should still be in Supabase.
14. Test a narrow browser window; forms and dashboard should remain usable.
15. Stop the server and check that the browser reports a friendly network/server error.

## 14. Troubleshooting

- **Server says a required environment variable is missing:** confirm `backend/.env` exists, contains real values, and you started the server from `backend/`.
- **Supabase returns an error:** verify the Project URL and server-side key, confirm `database/schema.sql` ran successfully, and check the terminal log.
- **`Invalid API key` / `401` from Supabase:** ensure the correct privileged key for the same Supabase project is used; rotate it if it was exposed.
- **`relation does not exist`:** run the SQL schema in the correct Supabase project.
- **Port already in use:** change `PORT=3001` in `.env` and open `http://localhost:3001`.
- **Login fails:** check email/password and confirm the account exists in `profiles`.
- **Admin options do not appear:** promote the profile in SQL, sign out, and sign in again.
- **Browser shows a blank page:** open Developer Tools → Console and check the terminal output. Confirm the server is running and open the app through `http://localhost:3000`.
- **Cookie/session problems:** use the same localhost URL consistently. In production, use HTTPS so secure cookies work.

## 15. Git and GitHub

1. Create an empty repository at https://github.com/new. Do not add a README if you already have one locally.
2. Open a terminal in the project root (`campus-complaint-grievance-management-system/`).
3. Check ignored files:
   ```bash
   git status --short
   ```
4. Initialize and push:
   ```bash
   git init
   git status
   git add .
   git status
   git commit -m "Build CampusCare grievance management system"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPOSITORY_URL
   git push -u origin main
   ```
   Replace `YOUR_GITHUB_REPOSITORY_URL` with your own repository URL from GitHub.
5. Refresh the GitHub repository page and verify the frontend, backend, database schema, and README are present.

Before pushing, ensure `backend/.env`, `node_modules/`, database exports, and personal data are not staged. `.env.example` should be included. `.gitignore` does not remove secrets already committed; if a secret is exposed, rotate it immediately and clean repository history.

## 16. Security notes and future improvements

- Passwords are hashed with bcrypt; raw passwords are never stored.
- The JWT is in an HTTP-only cookie and is not accessible to browser JavaScript.
- Authentication endpoints are rate-limited; Helmet adds security headers.
- Student/admin authorization is checked on the backend, not trusted from the browser.
- The Supabase privileged key is used only by the backend.
- For a real deployment, add HTTPS, account recovery, stronger operational logging, monitoring, automated backups, and a security review. Consider a managed identity provider and carefully designed RLS policies for user-scoped database access.
- Future features could include attachment uploads, department assignment, anonymous reporting where appropriate, notifications, analytics, and complaint feedback.

## 17. Final verification

- [ ] `frontend/`, `backend/`, and `database/` are present.
- [ ] `database/schema.sql` ran successfully in your own Supabase project.
- [ ] `backend/.env` contains your real values and is not committed.
- [ ] `npm run check` succeeds.
- [ ] `npm start` starts the server.
- [ ] Registration, login, complaint submission, list, details, and status updates work.
- [ ] Student ownership and admin-only access have been tested.
- [ ] The project has been pushed to GitHub without secrets.
