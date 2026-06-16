@echo off
echo Starting Docker services...
docker-compose up -d

echo Starting Django Backend...
start "SIDESI Backend" cmd /k "cd backend && venv\Scripts\python.exe manage.py runserver"

echo Starting Vite Frontend...
start "SIDESI Frontend" cmd /k "cd frontend && npm run dev"

echo ===================================================
echo All services have been launched!
echo Backend:  http://127.0.0.1:8000/
echo Frontend: http://localhost:5173/
echo ===================================================
pause
