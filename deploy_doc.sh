#!/bin/bash

set -o errexit -o nounset

if [ "$TRAVIS_BRANCH" != "master" ]
then
  echo "This commit was made against the $TRAVIS_BRANCH and not the master! No deploy!"
  exit 0
fi

rev=$(git rev-parse --short HEAD)

cd docs

git init
git config user.name "Grall Arnaud"
git config user.email "dev.arnaudgrall@gmail.com"

git remote add upstream "https://$GH_TOKEN@github.com/ran3d/n2n-overlay-wrtc.git"
git fetch upstream
git reset upstream/gh-pages

touch .

git add -A .
git commit -m "rebuild gh-pages with docs at ${rev}"
git push -q upstream HEAD:gh-pages
