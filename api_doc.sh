#!/bin/sh

DIR=$(dirname "$0")

mv "$1" tmp.ts
sed '/^@staticImplements<IPlugin>()/d' tmp.ts > "$1"
npx tsc
mv tmp.ts "$1"

cat ./api.mdx > tmp.md
jsdoc2md -t "$DIR/api_class.hbs" "$2" >> tmp.md
jsdoc2md -t "$DIR/api_type.hbs" -d 3 "$2" >> tmp.md
sed -i "" 's/Array.\&lt;/Array\&lt;/g' tmp.md
mv tmp.md "./$(basename $2 .js).md"