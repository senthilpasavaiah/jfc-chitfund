#!/bin/bash
# Starts Postgres, the backend API, and the frontend dev server.
# Usage: bash dev-start.sh   (run from the project root)

set -e

echo "Starting PostgreSQL..."
service postgresql start || true
sleep 1

echo "Starting backend (http://localhost:4000)..."
cd backend
setsid nohup node src/server.js > /tmp/jfc-backend.log 2>&1 < /dev/null &
cd ..

sleep 1

echo "Starting frontend (http://localhost:5173)..."
cd frontend
setsid nohup npx vite --host 0.0.0.0 > /tmp/jfc-frontend.log 2>&1 < /dev/null &
cd ..

sleep 2
echo ""
echo "Backend log:  tail -f /tmp/jfc-backend.log"
echo "Frontend log: tail -f /tmp/jfc-frontend.log"
echo ""
curl -s http://localhost:4000/health && echo "" && echo "Backend is up."
echo "Frontend: http://localhost:5173  (seeded admin: 9000000001 / Admin@123)"
