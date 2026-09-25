import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache_between_tests():
    """DRF's throttle classes (ScopedRateThrottle etc.) track request counts
    in Django's cache, which — unlike the database — isn't reset between
    tests by pytest-django's transaction rollback. Without this, one test's
    login attempts leak into the next test's throttle count."""
    cache.clear()
    yield
    cache.clear()
