"""Prints the centre of the first UI node whose text or content-desc equals argv[1] (uiautomator XML on stdin)."""
import re
import sys

xml, text = sys.stdin.read(), sys.argv[1]
for node in re.findall(r'<node [^>]*>', xml):
    if f'text="{text}"' in node or f'content-desc="{text}"' in node:
        x1, y1, x2, y2 = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node).groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
