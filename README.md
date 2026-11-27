
# SplitBill

A full-stack expense-sharing app for tracking shared costs, managing friend and group expenses, and settling up balances.

[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## Demo

[https://github.com/user-attachments/assets/bf97b090-2e62-49bd-ad83-3fe017b4c569](https://github.com/user-attachments/assets/bf97b090-2e62-49bd-ad83-3fe017b4c569)

> If the video doesn't load, you can [download or watch it directly](docs/splitbill-demo.mp4).

## Features

- **Authentication:** register, sign in, sign out, and reset a forgotten password via email verification
- **Friends:** add friends and manage friend invitations
- **Groups:** create groups, invite members, and manage membership
- **Expenses:** record expenses between friends or within groups
- **Splitting:** divide costs across participants and review who paid what
- **Balances:** track borrowings, lendings, and running balances
- **Settlements:** request, accept, reject, or cancel settlements
- **History:** review expense, settlement, invitation, and profile activity
- **Uploads:** profile pictures, group pictures, and expense receipts

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, Tailwind CSS, DaisyUI |
| Backend | Python, FastAPI, SQLAlchemy (async), Pydantic |
| Database | PostgreSQL with `asyncpg` |
| Authentication | Cookie-based auth, password hashing, JWT |
| Integrations | Gmail SMTP (password reset), Cloudinary (images and receipts) |

## Project Structure

```text
SplitBill/
├── backend_splitbill/   # FastAPI app, routers, schemas, database models, services
├── frontend_splitbill/  # React + Vite application
└── docs/
    └── splitbill-demo.mp4
```

## Prerequisites

- Python 3.10 or newer
- Node.js and npm
- PostgreSQL
- Cloudinary credentials (image and receipt uploads)
- SMTP app password (password reset emails)

## Getting Started

### 1. Configure the backend

From the repository root, create `backend_splitbill/.env`:

```env
POSTGRES_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/splitbill
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
TOKEN_SECRET_KEY=replace_with_a_long_random_secret
TOKEN_ALGORITHM=HS256
MAIL_PASSWORD=your_smtp_app_password
GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
AUTH_COOKIE_SECURE=false
```

> **Keep this file private.** Never commit `.env` to version control.

### 2. Set up the database

1. Create a PostgreSQL database named `splitbill` (or point `POSTGRES_URL` at your own database).
2. Create the tables using the SQL definitions in `backend_splitbill/Database_tables.txt`.
3. Apply any applicable SQL files in `backend_splitbill/migrations/`.

### 3. Install dependencies and start the API

From the repository root:

```bash
python -m venv .venv
```

Activate the virtual environment:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

Then install and run:

```bash
python -m pip install -r backend_splitbill/requirements.txt
uvicorn backend_splitbill.app:app --reload
```

The API runs at <http://localhost:8000>, with interactive docs at <http://localhost:8000/docs>.

### 4. Start the frontend

In a second terminal:

```bash
cd frontend_splitbill
npm install
npm run dev
```

Open the URL shown in the terminal (by default <http://localhost:5173>).

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_BACKEND_ORIGIN` | Frontend (Vite) | Backend address the dev server proxies `/api` requests to (default `http://localhost:8000`) |
| `VITE_API_BASE_URL` | Frontend (Vite) | Overrides the frontend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Frontend (Vite) | Google OAuth web client ID used by the Google signup button |
| `GOOGLE_CLIENT_ID` | Backend | Same Google OAuth web client ID; checks the audience of Google ID tokens |
| `AUTH_COOKIE_SECURE` | Backend | Set to `true` in production to send the session cookie only over HTTPS |

## Notes

- The backend loads `.env` from the **current working directory**, so start Uvicorn from the repository root as shown above.
- In development, the backend allows credentialed requests from `localhost:5173` and `127.0.0.1:5173`.
- Password reset emails and image uploads require valid SMTP and Cloudinary credentials.
