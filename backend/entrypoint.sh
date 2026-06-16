#!/bin/bash
# entrypoint.sh - Smart startup script that waits for MySQL to be ready

set -e

echo "================================================"
echo " SIDESI Backend - Startup Sequence"
echo "================================================"

echo ">>> [1/4] Asteptam ca MySQL sa fie disponibil..."

until python -c "
import pymysql, os, sys
try:
    conn = pymysql.connect(
        host=os.environ.get('DB_HOST', 'db'),
        port=int(os.environ.get('DB_PORT', '3306')),
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', 'rootpassword'),
        database=os.environ.get('DB_NAME', 'sidesi_db'),
        connect_timeout=3
    )
    conn.close()
    sys.exit(0)
except Exception as e:
    sys.exit(1)
" 2>/dev/null; do
    echo "    MySQL nu este inca gata. Re-verificam in 3 secunde..."
    sleep 3
done

echo "    >>> MySQL este disponibil!"

echo ">>> [2/4] Rulam migratiile Django..."
python manage.py migrate --noinput 2>&1 || {
    echo "    WARN: Migratie standard esuata, incercam cu --fake-initial..."
    python manage.py migrate --fake-initial --noinput 2>&1
}

echo ">>> [3/4] Populam baza de date cu date initiale..."
python manage.py seed_db

echo ">>> [4/4] Pornim serverul Django pe 0.0.0.0:8000..."
echo "================================================"
exec python manage.py runserver 0.0.0.0:8000
