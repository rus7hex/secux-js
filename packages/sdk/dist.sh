#!/bin/sh

rm -r ./lib

npx webpack --config ./webpack.base.config.js
npx webpack --config ./webpack.update.config.js

for i in {1..2}; do
    sed -i '' -e 's/\([^0-9a-zA-Z_]\)self\([^0-9a-zA-Z]\)/\1this\2/g' ./lib/*.js
done
