from django.apps import AppConfig


class VirtualEccConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.virtual_ecc'
    verbose_name = 'Echipamente de Casă Virtuale'

    def ready(self):
        import apps.virtual_ecc.signals  # noqa: F401
