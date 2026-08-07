#!/bin/sh
# Rewrite the site's canonical domain.
#
# The pages carry absolute URLs in <link rel="canonical">, the Open Graph and
# Twitter tags, the JSON-LD blocks, sitemap.xml and robots.txt. They all say
# https://resonare.digital.
#
# That is correct once resonare.digital points at your host. It is WRONG while
# the site lives on a preview subdomain — a canonical tag pointing at a domain
# that does not serve the site tells Google to index nothing.
#
# Usage:
#   ./set-domain.sh https://your-site.netlify.app
#   ./set-domain.sh https://resonare.digital        # to change it back
#
# Safe to run repeatedly: it rewrites whatever the current domain is.

set -eu

NEW="${1:-}"
if [ -z "$NEW" ]; then
  echo "usage: $0 https://your-domain" >&2
  exit 1
fi

# normalise: no trailing slash.
# `|` as the sed delimiter throughout — the default `/` and a `:` both appear
# inside a URL ("https://"), and either one silently breaks the expression.
NEW=$(printf '%s' "$NEW" | sed 's|/*$||')

# find whatever domain is currently baked in, from the homepage canonical
OLD=$(sed -n 's|.*<link rel="canonical" href="\(https\{0,1\}://[^/"]*\).*|\1|p' index.html | head -1)
if [ -z "$OLD" ]; then
  echo "could not find a canonical URL in index.html" >&2
  exit 1
fi

if [ "$OLD" = "$NEW" ]; then
  echo "already set to $NEW — nothing to do"
  exit 0
fi

echo "rewriting $OLD  ->  $NEW"
for f in *.html sitemap.xml robots.txt; do
  [ -f "$f" ] || continue
  # macOS sed needs -i ''; GNU sed needs -i. Write to a temp file to suit both.
  sed "s|$OLD|$NEW|g" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  echo "  $f"
done
echo "done. Re-upload the folder."
