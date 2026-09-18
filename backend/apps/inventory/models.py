import io
import uuid

from django.core.files.base import ContentFile
from django.db import models
from django.utils import timezone


class InventoryItem(models.Model):
    """
    Represents a physical inventory object assigned to a user.
    Images are automatically resized and compressed via Pillow on save.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=255, db_index=True, verbose_name='Denumire obiect')
    inventory_number = models.CharField(
        max_length=100, unique=True, blank=True, null=True,
        db_index=True, verbose_name='Număr de inventar'
    )
    description = models.TextField(blank=True, null=True, verbose_name='Descriere')
    quantity = models.PositiveIntegerField(default=1, verbose_name='Cantitate')

    assigned_to = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        related_name='inventory_items',
        verbose_name='Responsabil / Deținător'
    )

    image = models.ImageField(
        upload_to='inventory/',
        blank=True,
        null=True,
        verbose_name='Fotografie obiect'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Obiect Inventar'
        verbose_name_plural = 'Obiecte Inventar'

    def __str__(self):
        return f"{self.name} — {self.assigned_to.username} ({self.quantity} buc.)"

    def save(self, *args, **kwargs):
        """Override save to compress and resize uploaded images automatically."""
        if self.image and hasattr(self.image, 'file'):
            try:
                from PIL import Image as PILImage

                # Open the uploaded image with Pillow
                img = PILImage.open(self.image)

                # Convert RGBA / palette modes to RGB (JPEG doesn't support transparency)
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = PILImage.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    if img.mode in ('RGBA', 'LA'):
                        background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Resize to a maximum of 1200x1200 (preserving aspect ratio)
                max_size = (1200, 1200)
                img.thumbnail(max_size, PILImage.Resampling.LANCZOS)

                # Save as JPEG at 75% quality into a BytesIO buffer
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=75, optimize=True)
                output.seek(0)

                # Replace image field with the compressed version
                new_filename = f"{uuid.uuid4()}.jpg"
                self.image.save(new_filename, ContentFile(output.read()), save=False)

            except Exception as e:
                # If Pillow fails for any reason, proceed with the original image
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Image compression failed for inventory item: {e}")

        super().save(*args, **kwargs)
