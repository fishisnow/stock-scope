# -*- coding: utf-8 -*-
"""线程安全的内存 TTL 缓存。"""

import copy
import threading
import time
from typing import Any, Dict, Optional, Tuple


class TtlMemoryCache:
    def __init__(self):
        self._store: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expires_at, value = item
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return copy.deepcopy(value)

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            self._store[key] = (time.monotonic() + ttl_seconds, copy.deepcopy(value))


leader_stock_metrics_cache = TtlMemoryCache()
LEADER_STOCK_METRICS_TTL_SECONDS = 24 * 60 * 60
