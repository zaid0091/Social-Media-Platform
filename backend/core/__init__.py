import redis.connection
redis.connection.DEFAULT_RESP_VERSION = 2

def dummy_configure(self, *args, **kwargs):
    self._maint_notifications_pool_handler = None
    self._maint_notifications_connection_handler = None
    self._oss_cluster_maint_notifications_handler = None
    return

redis.connection.AbstractConnection._configure_maintenance_notifications = dummy_configure

from .celery import app as celery_app

__all__ = ('celery_app',)
