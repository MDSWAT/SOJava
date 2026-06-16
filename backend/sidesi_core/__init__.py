import pymysql

pymysql.install_as_MySQLdb()

# This will make sure the app is always imported when
# Django starts so that shared_task will use this app.
from sidesi_core.celery import app as celery_app

__all__ = ('celery_app',)
