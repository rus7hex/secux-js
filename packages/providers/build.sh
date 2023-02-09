#!/bin/sh

rm -r ./dist
npx webpack

for i in {1..2}; do
    sed -i '' -e 's/\([^0-9a-zA-Z_]\)self\([^0-9a-zA-Z]\)/\1this\2/g' ./dist/*.js
done
