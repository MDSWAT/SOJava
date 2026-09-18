from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Seed the database with initial roles, permissions, and the default Super Admin user'

    def handle(self, *args, **options):
        try:
            with transaction.atomic():
                self._seed_permissions()
                self._seed_roles()
                self._seed_superadmin()
            self.stdout.write(self.style.SUCCESS('[OK] Baza de date a fost populata cu succes!'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'[ERROR] Eroare la popularea bazei de date: {e}'))
            raise

    def _seed_permissions(self):
        from apps.authentication.models import Permission

        permissions = [
            # Vault permissions
            ('vault:view', 'vault', 'Poate vedea parolele din Vault'),
            ('vault:create', 'vault', 'Poate adăuga parole noi'),
            ('vault:update', 'vault', 'Poate edita parole existente'),
            ('vault:delete', 'vault', 'Poate șterge parole'),
            ('vault:reveal', 'vault', 'Poate dezvălui parola în clar'),
            ('vault:copy', 'vault', 'Poate copia parola în clipboard'),
            ('vault:import', 'vault', 'Poate importa parole din Excel'),
            ('vault:export', 'vault', 'Poate exporta parole în Excel'),

            # Users permissions
            ('users:view', 'users', 'Poate vedea lista de utilizatori'),
            ('users:manage', 'users', 'Poate gestiona utilizatorii (CRUD)'),

            # Roles permissions
            ('roles:view', 'roles', 'Poate vedea rolurile'),
            ('roles:manage', 'roles', 'Poate gestiona rolurile'),

            # Audit permissions
            ('audit:view', 'audit', 'Poate vedea logurile de audit'),
            ('audit:export', 'audit', 'Poate exporta logurile de audit'),

            # Organizations permissions
            ('organizations:view', 'organizations', 'Poate vedea organizațiile'),
            ('organizations:manage', 'organizations', 'Poate gestiona organizațiile'),

            # Personal vault permissions
            ('personal_vault:view', 'personal_vault', 'Poate vedea propriul vault personal'),
            ('personal_vault:manage', 'personal_vault', 'Poate gestiona vaultul personal'),

            # Duty days permissions
            ('duty_days:view', 'duty_days', 'Poate vedea calendarul zilelor de serviciu'),
            ('duty_days:assign', 'duty_days', 'Poate selecta zile de serviciu'),
            ('duty_days:manage', 'duty_days', 'Poate gestiona complet zilele de serviciu'),

            # Inventory permissions
            ('inventory:view', 'inventory', 'Poate vedea modulul de inventar'),
            ('inventory:manage', 'inventory', 'Poate adăuga, edita și șterge obiecte din inventar'),

            # Virtual ECC permissions
            ('virtual_ecc:view', 'virtual_ecc', 'Vizualizare Echipamente de Casă Virtuale'),
            ('virtual_ecc:manage', 'virtual_ecc', 'Administrare Echipamente de Casă Virtuale'),
            ('virtual_ecc:reveal', 'virtual_ecc', 'Dezvăluire Cheie MEV'),
        ]

        created_count = 0
        for code, module, description in permissions:
            _, created = Permission.objects.get_or_create(
                code=code,
                defaults={'module': module, 'description': description}
            )
            if created:
                created_count += 1

        self.stdout.write(f'  -> {created_count} permisiuni noi create')

    def _seed_roles(self):
        from apps.authentication.models import Role, Permission

        # Super Admin — all permissions
        super_admin_role, _ = Role.objects.get_or_create(
            name='Super Admin',
            defaults={'description': 'Acces complet la toate modulele', 'is_system': True}
        )
        all_perms = Permission.objects.all()
        super_admin_role.permissions.set(all_perms)

        # Admin — most permissions, no user management
        admin_role, _ = Role.objects.get_or_create(
            name='Admin',
            defaults={'description': 'Administrator cu acces extins', 'is_system': True}
        )
        admin_perms = Permission.objects.exclude(code__in=['users:manage', 'roles:manage'])
        admin_role.permissions.set(admin_perms)

        # Operator — vault read + copy, personal vault, inventory view
        operator_role, _ = Role.objects.get_or_create(
            name='Operator',
            defaults={'description': 'Operator cu acces la vault', 'is_system': True}
        )
        operator_perms = Permission.objects.filter(
            code__in=['vault:view', 'vault:copy', 'personal_vault:view', 'personal_vault:manage',
                      'duty_days:view', 'duty_days:assign', 'inventory:view']
        )
        operator_role.permissions.set(operator_perms)

        # User — basic read-only
        user_role, _ = Role.objects.get_or_create(
            name='User',
            defaults={'description': 'Utilizator standard - acces minim', 'is_system': True}
        )
        user_perms = Permission.objects.filter(
            code__in=['personal_vault:view', 'personal_vault:manage',
                      'duty_days:view', 'duty_days:assign', 'inventory:view']
        )
        user_role.permissions.set(user_perms)

        self.stdout.write('  -> Roluri configurate: Super Admin, Admin, Operator, User')

    def _seed_superadmin(self):
        from django.contrib.auth import get_user_model
        from apps.authentication.models import Role

        User = get_user_model()

        if User.objects.filter(username='stefan').exists():
            self.stdout.write('  -> Super Admin "stefan" exista deja')
            return

        super_admin_role = Role.objects.get(name='Super Admin')

        User.objects.create_superuser(
            username='stefan',
            email='stefan@posta.md',
            password='Pumba2003',
            role=super_admin_role,
            first_name='Stefan',
            last_name='Admin'
        )

        self.stdout.write('  -> Super Admin "stefan" creat cu succes')
