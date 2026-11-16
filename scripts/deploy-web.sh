#!/bin/zsh
# Builds the web admin and publishes ONLY the built files to the `deploy` branch on GitHub.
# Hostinger (Git deploy, branch `deploy`) picks it up from there. Run from anywhere: ./scripts/deploy-web.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="$(git -C "$ROOT" remote get-url origin)"
cd "$ROOT/app"
npx expo export --platform web --output-dir dist
[ -f dist/.htaccess ] || { echo "missing .htaccess in build"; exit 1; }
TMP="$(mktemp -d)"
cp -R dist/. "$TMP"/
cd "$TMP"
git init -q -b deploy
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "Web build $(date '+%Y-%m-%d %H:%M')"
git push -q --force "$REMOTE" deploy
rm -rf "$TMP"
echo "Published to branch 'deploy'."
