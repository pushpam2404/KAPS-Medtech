# KAPS MedTech — Local and Cloud Setup Guide

This guide provides instructions for setting up the **KAPS MedTech** application environment locally or deploying it to a cloud provider.

---

## 1. Local Development Setup

### System Prerequisites
- **Node.js**: Version 14 or higher (supports native fetch/ES modules)
- **PostgreSQL**: Version 12 or higher running locally

### Step-by-Step Installation

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/Pushpam-2404/KAPS_MedTech.git
   cd KAPS_MedTech
   npm install
   ```

2. **Configure Database**:
   Log in to your PostgreSQL CLI or GUI client (like pgAdmin or DBeaver) and create a database:
   ```sql
   CREATE DATABASE kaps_health;
   ```

3. **Configure Environment Variables**:
   Create a new file named `.env` in the `backend/` folder:
   ```env
   # backend/.env
   DATABASE_URL=postgresql://postgres:yourlocalpassword@localhost:5432/kaps_health
   JWT_SECRET=a_long_random_string_for_signing_tokens
   PORT=3001
   ALLOWED_ORIGINS=http://localhost:3001
   ```

4. **Initialize Schema & Seed Data**:
   This runs the queries in `backend/schema.sql` to build tables, indexes, and seed sample user accounts:
   ```bash
   node backend/init_db.js
   ```
   *Verify that you see the success message: `✅ Schema Executed Successfully! Tables created.`*

5. **Start Server**:
   ```bash
   npm start
   ```
   The backend will start and host the static files on port `3001`. Open your browser and navigate to `http://localhost:3001` to test the login interface.

---

## 2. Cloud Database Setup (Neon)

Neon is a serverless PostgreSQL database provider that integrates well with serverless runtimes.

1. Create a free account at [Neon.tech](https://neon.tech) and click **Create Project**.
2. Copy the **Connection String** from the dashboard. It will look like:
   `postgresql://alex:pass999@ep-cool-server.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. Run the schema migrations from your local computer, pointing to the cloud database:
   ```bash
   DATABASE_URL="your-copied-neon-connection-string" node backend/init_db.js
   ```

---

## 3. Deploying to Vercel

Vercel is the recommended hosting platform for KAPS MedTech.

1. **Commit and Push**: Ensure your changes are committed and pushed to a remote GitHub repository.
2. **Import Project**: Log in to [Vercel](https://vercel.com) and click **Add New** -> **Project**. Select your repository.
3. **Configure Environment Variables**:
   In the project settings panel, add the following variables:
   - `DATABASE_URL`: *Your Neon connection string*
   - `JWT_SECRET`: *A secure random string*
   - `NODE_ENV`: `production`
4. **Deploy**: Click **Deploy**. Vercel will build the Node routes and serve the static files.

---

## 4. Diagnostics & Health Verification

If you encounter connection issues, test the API health status:
- Open your browser to the health route: `https://your-app.vercel.app/api/health`
- An active connection returns:
  ```json
  { "status": "OK", "db": "Connected" }
  ```
- If this returns an error, verify the `DATABASE_URL` in your environment variables.
