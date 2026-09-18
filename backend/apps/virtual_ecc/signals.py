import os
from django.db.models.signals import pre_save, post_delete
from django.dispatch import receiver
from .models import VirtualECC


@receiver(pre_save, sender=VirtualECC)
def delete_old_pdf_on_change(sender, instance, **kwargs):
    """Delete the old PDF file from disk when it's replaced or cleared."""
    if not instance.pk:
        return

    try:
        old = VirtualECC.objects.get(pk=instance.pk)
    except VirtualECC.DoesNotExist:
        return

    old_file = old.pdf_file
    new_file = instance.pdf_file

    if old_file and old_file.name:
        # If new file is different or being cleared, remove old from disk
        if (not new_file) or (new_file.name != old_file.name):
            try:
                if os.path.isfile(old_file.path):
                    os.remove(old_file.path)
            except (ValueError, OSError):
                pass


@receiver(post_delete, sender=VirtualECC)
def delete_pdf_on_delete(sender, instance, **kwargs):
    """Delete the PDF file from disk when the record is deleted."""
    if instance.pdf_file and instance.pdf_file.name:
        try:
            if os.path.isfile(instance.pdf_file.path):
                os.remove(instance.pdf_file.path)
        except (ValueError, OSError):
            pass
