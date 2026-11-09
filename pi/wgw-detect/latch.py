"""Presence latch that tolerates a flickering detector (kept free of cv2/onnx so it can be tested alone)."""
from collections import deque


class Latch:
    """ON after min_hits detections within `window` seconds; OFF after `window` seconds with none."""

    def __init__(self, window: float, min_hits: int) -> None:
        self.window, self.min_hits = window, min_hits
        self.hits: deque = deque()
        self.stable = False

    def update(self, now: float, present: bool) -> bool:
        if present:
            self.hits.append(now)
        while self.hits and now - self.hits[0] > self.window:
            self.hits.popleft()
        if not self.stable and len(self.hits) >= self.min_hits:
            self.stable = True
        elif self.stable and not self.hits:
            self.stable = False
        return self.stable
