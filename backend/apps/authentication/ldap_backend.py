import json
import logging
import urllib.request
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend
from django.utils import timezone
from apps.authentication.models import Role

logger = logging.getLogger(__name__)
User = get_user_model()

class ActiveDirectoryBackend(BaseBackend):
    """
    SIDESI Active Directory / LDAP authentication backend.
    Connects to the auth_proxy microservice via HTTP to verify credentials.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None

        # Clean/normalize username: strip domain suffix or prefix if present
        # e.g., "stefan.serghei@posta.md" -> "stefan.serghei", "INTRANET\stefan.serghei" -> "stefan.serghei"
        if '@' in username:
            username = username.split('@')[0]
        if '\\' in username:
            username = username.split('\\')[-1]

        # Check if user exists locally and is inactive/disabled
        try:
            local_user = User.objects.get(username=username)
            if not local_user.is_active:
                logger.warning(f"AD User '{username}' attempted to log in but is deactivated/inactive locally.")
                return None
        except User.DoesNotExist:
            pass

        # Call auth_proxy microservice
        is_valid_ad_user = self._verify_via_auth_proxy(username, password)
        
        # Fallback to local DB password if AD check failed but we are in DEBUG/dev environment
        if not is_valid_ad_user:
            from django.conf import settings
            if settings.DEBUG:
                try:
                    user = User.objects.get(username=username)
                    if user.check_password(password):
                        logger.info(f"AD User {username} authenticated via local DB password fallback (DEBUG mode).")
                        return user
                except User.DoesNotExist:
                    pass

        if is_valid_ad_user:
            try:
                # Assign role: stefan.serghei gets Super Admin, others get default User
                role_name = 'Super Admin' if username == 'stefan.serghei' else 'User'
                default_role, _ = Role.objects.get_or_create(
                    name=role_name, 
                    defaults={'description': f'Implicit synced AD {role_name}'}
                )
                
                # Fetch or create the user in local Django db
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': f"{username}@posta.md",
                        'first_name': username.split('.')[0].capitalize() if '.' in username else username.capitalize(),
                        'last_name': username.split('.')[1].capitalize() if '.' in username else 'AD_User',
                        'role': default_role,
                        'is_ad_synced': True,
                    }
                )
                
                # Update AD specific fields on each successful sync
                user.last_sync_at = timezone.now()
                user.is_active = True
                user.is_ad_synced = True
                
                # Sync password copy locally for Django session checks
                user.set_password(password)
                user.save()
                
                logger.info(f"AD User {username} synced & authenticated successfully via proxy.")
                return user
                
            except Exception as e:
                logger.error(f"Error syncing AD User {username}: {str(e)}")
                return None
                
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    def _verify_via_auth_proxy(self, username, password) -> bool:
        """
        Sends authentication request to the auth_proxy microservice.
        """
        from django.conf import settings
        url = getattr(settings, 'AUTH_PROXY_URL', 'http://auth_proxy:9000/auth')
        payload = {"login": username, "password": password}
        data = json.dumps(payload).encode("utf-8")
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data.get("success", False)
        except Exception as e:
            logger.error(f"Failed to connect to auth_proxy at {url}: {e}")
            return False
