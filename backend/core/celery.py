import os
import redis.connection
redis.connection.DEFAULT_RESP_VERSION = 2

def dummy_configure(self, *args, **kwargs):
    self._maint_notifications_pool_handler = None
    self._maint_notifications_connection_handler = None
    self._oss_cluster_maint_notifications_handler = None
    return

redis.connection.AbstractConnection._configure_maintenance_notifications = dummy_configure

from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()
