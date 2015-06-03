#!/usr/bin/env python

import sys
import requests

def read_lines(fname):
    with open(fname) as f:
        return f.readlines()

def write_lines(fname, lines):
    with open(fname, 'w') as f:
        f.writelines(lines)

def obtain_words(howmany):
    returned = 0

    try:
        while returned < howmany:
            newNameStr = requests.get('http://www.namegenerator.biz/application/p.php?type=1&id=place_names&spaceflag=false')
            words = filter(bool, newNameStr.text.split(','));

            for word in words:
                yield word
                returned += 1

            print(returned, '/', howmany, ' - ', returned / howmany)

    except KeyboardInterrupt:
        print('\rStopped!')



leftFile = sys.argv[1]
rightFile = sys.argv[2]
howmany = int(sys.argv[3])

leftWords = list(map(str.strip, read_lines(leftFile)))
rightWords = list(map(str.strip, read_lines(rightFile)))
noMatch = []

newLefts = 0
newRights = 0

for word in obtain_words(howmany):
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

        print('L:', other)

    # Matches left, not right
    if matchleft and not matchright:
        other = word[len(matchleft):]
        rightWords.append(other)
        newRights += 1

        print('R:', other)

    if not matchleft and not matchright:
        noMatch.append(wordd)

        print('N:', word)

print('Found {} new left words'.format(newLefts))
write_lines(leftFile, map(lambda x: x+'\n', sorted(leftWords)))


print('Found {} new right words'.format(newRights))
write_lines(rightFile, map(lambda x: x+'\n', sorted(rightWords)))

print('Found {} unsplitted words'.format(len(noMatch)))
print(', '.join(noMatch))