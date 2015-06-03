#!/usr/bin/env python

import sys

def read_lines(fname):
    with open(fname) as f:
        return f.readlines()

def write_lines(fname, lines):
    with open(fname, 'w') as f:
        f.writelines(lines)

leftFile = sys.argv[1]
rightFile = sys.argv[2]
newFile = sys.argv[3]

leftWords = list(map(str.strip, read_lines(leftFile)))
rightWords = list(map(str.strip, read_lines(rightFile)))
newWords = list(map(str.strip, read_lines(newFile)))

newLefts = 0
newRights = 0

for word in newWords:
    word = word.strip()

    matchleft = False
    matchright = False

    # Check if it matches from the left and from the right
    for lw in leftWords:
        if word.startswith(lw):
            matchleft = lw

    for rw in rightWords:
        if word.endswith(rw):
            matchright = rw

    # Matches right, not left
    if not matchleft and matchright:
        other = word[:-len(matchright)]
        leftWords.append(other)
        newLefts += 1

    # Matches left, not right
    if matchleft and not matchright:
        other = word[len(matchleft):]
        rightWords.append(other)
        newRights += 1

    # No match at all
    if not matchleft and not matchright:
        print(word, 'NONE')

print('Found {} new left words'.format(newLefts))
write_lines(leftFile, map(lambda x: x+'\n', sorted(leftWords)))


print('Found {} new right words'.format(newRights))
write_lines(rightFile, map(lambda x: x+'\n', sorted(rightWords)))