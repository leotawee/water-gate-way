"""Run: python3 test_latch.py"""
from latch import Latch

# flickering person (hit, miss, hit, miss ...) at 1.4 fps must still latch ON; the old 3 s continuous rule never did
l = Latch(5.0, 2)
t, out = 0.0, []
for i in range(8):
    out.append(l.update(t, i % 2 == 0))
    t += 0.7
assert out[-1] is True, out

# one stray hit does not latch
l = Latch(5.0, 2)
assert l.update(0.0, True) is False
assert l.update(1.0, False) is False

# OFF only after `window` seconds without a hit
l = Latch(5.0, 2)
l.update(0.0, True); l.update(0.7, True)
assert l.update(3.0, False) is True
assert l.update(5.6, False) is True      # last hit 4.9 s ago, still inside the window
assert l.update(5.8, False) is False     # 5.1 s ago, dropped
print("latch ok")
