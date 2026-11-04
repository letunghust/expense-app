"""Prints the centre of the first UI node whose text or content-desc equals argv[1], or of the Nth photo in the
system photo picker with --photo N (uiautomator XML on stdin)."""
import re
import sys

xml = sys.stdin.read()
nodes = re.findall(r'<node [^>]*>', xml)


def centre(node):
    x1, y1, x2, y2 = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node).groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


if sys.argv[1] == '--photo':
    photos = [node for node in nodes if 'content-desc="Photo taken' in node]
    index = int(sys.argv[2]) - 1
    if index < len(photos):
        print(*centre(photos[index]))
else:
    text = sys.argv[1].replace("'", '&apos;')
    for node in nodes:
        if f'text="{text}"' in node or f'content-desc="{text}"' in node:
            print(*centre(node))
            break
