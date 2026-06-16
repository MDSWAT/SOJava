from cryptography.fernet import Fernet
from django.conf import settings

class VaultCryptor:
    """
    AES-256 encryption helper utilizing Cryptography's Fernet symmetric keys.
    """
    def __init__(self):
        # Sourced from Django secure settings
        self.key = settings.ENCRYPTION_KEY.encode()
        self.cipher_suite = Fernet(self.key)

    def encrypt(self, plain_text: str) -> str:
        """
        Encrypt a clear text string into an AES-256 secure base64 representation.
        """
        if not plain_text:
            return ""
        encrypted_bytes = self.cipher_suite.encrypt(plain_text.encode())
        return encrypted_bytes.decode()

    def decrypt(self, cipher_text: str) -> str:
        """
        Decrypt a base64 encoded ciphertext string back to plain text.
        """
        if not cipher_text:
            return ""
        decrypted_bytes = self.cipher_suite.decrypt(cipher_text.encode())
        return decrypted_bytes.decode()
