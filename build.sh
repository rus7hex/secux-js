#!/bin/sh

rm -r ./lib

DIR=$(pwd)
SRC=$(basename "$DIR").ts

if [[ $SRC =~ ^app- || $SRC =~ ^transport- ]] 
then
    SRC=./src/$SRC
    mv $SRC tmp.ts
    sed '/^@staticImplements<IPlugin>()/d' tmp.ts > $SRC
    
    if [[ -f "./webpack.config.js" ]]
    then
        rm -r ./dist
        npx webpack
        for i in {1..2}; do
            sed -i '' -e 's/\([^0-9a-zA-Z_]\)self\([^0-9a-zA-Z]\)/\1this\2/g' ./dist/*.js
        done
    fi

    npx tsc
    mv tmp.ts $SRC
else
    npx tsc
fi

mkdir ./tmp
mv ./lib/*.js ./tmp
for f in ./tmp/*.js
do
    npx terser -c --ecma 2017 --toplevel -o "./lib/$(basename $f)" $f
done
rm -r ./tmp
