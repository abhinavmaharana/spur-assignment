# Quick Start Guide

## 🚀 Fastest Way to Get Running

### Option 1: SQLite (Easiest - No Database Setup)

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Backend setup:**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```env
   DATABASE_URL="file:./dev.db"
   GEMINI_API_KEY=your_key_here
   PORT=4000
   ```

3. **Update Prisma schema for SQLite:**
   
   Edit `backend/prisma/schema.prisma`:
   - Comment out the `postgresql` datasource
   - Uncomment the `sqlite` datasource

4. **Setup database:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Start backend:**
   ```bash
   npm run dev
   ```

6. **In a new terminal, start frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

7. **Open browser:** `http://localhost:5173`

### Option 2: PostgreSQL (Production-like)

1. **Install PostgreSQL** and create a database:
   ```sql
   CREATE DATABASE spur_chat;
   ```

2. **Follow Option 1 steps**, but use PostgreSQL URL in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/spur_chat?schema=public"
   ```

3. **Keep PostgreSQL datasource** in `schema.prisma` (default)

## ✅ Verify Everything Works

1. Backend should show: `Server running on http://localhost:4000`
2. Frontend should open automatically
3. Type a message like "What is your return policy?" and press Enter
4. You should see an AI response

## 🐛 Troubleshooting

### "GEMINI_API_KEY is required"
- Make sure you've set `GEMINI_API_KEY` in `backend/.env`
- Get your key from: https://aistudio.google.com/apikey

### Database connection errors
- For SQLite: Make sure the file path is correct
- For PostgreSQL: Verify credentials and that the database exists

### Frontend can't connect to backend
- Verify backend is running on port 4000
- Check browser console for CORS errors
- Ensure `API_URL` in `+page.svelte` matches your backend port
