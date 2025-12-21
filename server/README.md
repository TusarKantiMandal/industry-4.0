# Industry 4.0 Server

This is the backend server for the Industry 4.0 application. It provides APIs for managing users, machines, checkpoints, and collecting data from the shop floor.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Local Setup

1.  **Clone the repository** (if you haven't already).
2.  **Navigate to the server directory**:
    ```bash
    cd server
    ```
3.  **Initialize the project**:
    Run the initialization script to install dependencies and seed the database with initial data.
    ```bash
    ./init.sh
    ```
    Alternatively, you can run manually:
    ```bash
    npm install
    node seed.js
    ```
    *Note: `seed.js` will automatically create the `database.db` file and the necessary tables if they do not exist.*

4.  **Start the server**:
    ```bash
    npm start
    ```
    The server will start running at `http://localhost:3000`.

## Environment Variables (.env)

Create a `.env` file in the `server` directory to configure the application. The following variables are supported:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | The port the server listens on. | `3000` |
| `JWT_SECRET` | Secret key used for signing JSON Web Tokens. | `SECRET_KEY` (Change this in production!) |
| `SMTP_USER` | Email address for sending notifications (e.g., OTPs). | `your-email@gmail.com` |
| `SMTP_PASS` | Password or App Password for the email account. | `your-app-password` |

**Example `.env` file:**

```env
PORT=3000
JWT_SECRET=some_secret
SMTP_USER=admin@industry40.com
SMTP_PASS=secure_password
```

## Database

The project uses SQLite (`database.db`). The database schema is automatically initialized in `server.js` (and `seed.js`) if it doesn't exist.
The `seed.js` script populates the database with initial data:
- **Plants**: Gear Plant, Axle Plant
- **Users**:
    - `itAdmin` (Password: `123456`) - IT Administrator
    - `alice` (Password: `password123`) - Admin
    - `bob` (Password: `password456`) - User
    - `ptt` (Password: `ptt`) - PTT User
- **Machines**: Lathe Machine, Drill Press, Milling Machine

## API Documentation

- **Admin Dashboard**: `/admin` (Redirects based on role)
- **IT Admin Panel**: `/admin/it`
- **PTT Dashboard**: `/admin/ptt`
- **Summary Page**: `/admin/it/summary` or `/admin/ptt/summary`

## Project Structure

- `server.js`: Main entry point.
- `api.js`: General API routes.
- `it.js`: IT Admin routes.
- `ptt.js`: PTT Admin routes.
- `public/`: Static frontend files (HTML, CSS, JS).
- `database.db`: SQLite database file.
