import uuid
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    """Custom queryset that supports soft deletion operations."""

    def delete(self):
        """Soft delete all items in queryset."""
        return super().update(deleted_at=timezone.now())

    def hard_delete(self):
        """Permanently remove items from the database."""
        return super().delete()

    def alive(self):
        """Return only non-deleted records."""
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        """Return only soft-deleted records."""
        return self.filter(deleted_at__isnull=False)


class SoftDeleteManager(models.Manager):
    """Default manager that excludes soft-deleted records."""

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def all_with_deleted(self):
        """Return all records including soft-deleted."""
        return SoftDeleteQuerySet(self.model, using=self._db)

    def only_deleted(self):
        """Return only soft-deleted records."""
        return SoftDeleteQuerySet(self.model, using=self._db).dead()


class Organization(models.Model):
    """
    Organizations to segment passwords (e.g., '218 CCL').
    Supports UUIDs and Soft Deletion.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, db_index=True)
    code = models.CharField(max_length=50, unique=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True, db_index=True)

    objects = SoftDeleteManager()

    class Meta:
        ordering = ['name']

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.save(using=using)

    def hard_delete(self):
        super().delete()

    def restore(self):
        self.deleted_at = None
        self.save()

    def __str__(self):
        return self.name
