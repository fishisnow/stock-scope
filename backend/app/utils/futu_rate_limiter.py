# -*- coding: utf-8 -*-
"""富途 OpenD 财报接口频率限制（每 30 秒最多 30 次）。"""

import threading
import time
from collections import deque


class FinancialApiRateLimiter:
    def __init__(self, max_calls: int = 30, period_seconds: float = 30.0):
        self.max_calls = max_calls
        self.period_seconds = period_seconds
        self._timestamps: deque[float] = deque()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        with self._lock:
            while True:
                now = time.monotonic()
                while self._timestamps and now - self._timestamps[0] >= self.period_seconds:
                    self._timestamps.popleft()

                if len(self._timestamps) < self.max_calls:
                    self._timestamps.append(now)
                    return

                wait_seconds = self.period_seconds - (now - self._timestamps[0]) + 0.05
                if wait_seconds > 0:
                    time.sleep(wait_seconds)


financial_api_rate_limiter = FinancialApiRateLimiter(max_calls=30, period_seconds=30.0)
