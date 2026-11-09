#!/usr/bin/env bash
# Prüft Dateien und die gesamte Git-Historie auf Verstöße gegen die Git-Regeln
# und den App-Code auf externe Anfragen und verbotene Senken.
# Aufruf: scripts/cleanup.sh [--fix]   Exit-Code 1 bei Funden, sonst 0.
# --fix bereinigt nur Dateien im Arbeitsverzeichnis; die Historie wird nie umgeschrieben.
set -euo pipefail

ERLAUBT_IDENTITAET='creo08 <285598642+creo08@users.noreply.github.com>'
ERLAUBT_MAIL='285598642+creo08@users.noreply.github.com'
ERLAUBTE_URLS='^https://github\.com/creo08/muEBS(/|$)|^https://github\.com/relaxin101/barsystem$'
SELBST='scripts/cleanup.sh'

FIX=0
[[ "${1:-}" == "--fix" ]] && FIX=1

cd "$(git rev-parse --show-toplevel)"
FUNDE=0
HISTORIE=0

fund() { # $1 = Ort, $2 = Text
  printf 'FUND %s: %s\n' "$1" "$2"
  FUNDE=$((FUNDE + 1))
}

# Muster für Texte (Commits, Tags, Dateien)
SITZUNG='claude\.ai/code/session_|Claude-Session:'
MITAUTOR='^[[:space:]]*Co-Authored-By:'
TRAILER_PERSON='^[A-Za-z][A-Za-z-]*-[Bb]y:|^[A-Za-z][A-Za-z-]*:[^<]*<[^>]*@[^>]*>'
MAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'

# Prüft einen Text; $1 = Ort, Text auf stdin
pruefe_text() {
  local ort="$1" text zeile
  text="$(cat)"
  while IFS= read -r zeile; do
    [[ -n "$zeile" ]] && fund "$ort" "Sitzungs-Zeile oder Sitzungs-Link: $zeile"
  done < <(grep -E "$SITZUNG" <<<"$text" || true)
  while IFS= read -r zeile; do
    [[ -n "$zeile" ]] && fund "$ort" "Mitautor- oder Personen-Trailer: $zeile"
  done < <(grep -iE "$MITAUTOR" <<<"$text"; grep -E "$TRAILER_PERSON" <<<"$text" | grep -viE "$MITAUTOR" || true)
  while IFS= read -r zeile; do
    [[ -n "$zeile" && "$zeile" != "$ERLAUBT_MAIL" ]] && fund "$ort" "E-Mail-Adresse: $zeile"
  done < <(grep -oE "$MAIL" <<<"$text" | sort -u || true)
  return 0 # sonst bricht set -e ab, wenn der letzte Treffer erlaubt ist
}

# ---------- 1. Git-Historie aller Branches und Tags ----------
while IFS= read -r commit; do
  kurz="${commit:0:7}"
  autor="$(git show -s --format='%an <%ae>' "$commit")"
  committer="$(git show -s --format='%cn <%ce>' "$commit")"
  vorher=$FUNDE
  [[ "$autor" == "$ERLAUBT_IDENTITAET" ]] || fund "Commit $kurz" "Autor ist $autor"
  [[ "$committer" == "$ERLAUBT_IDENTITAET" ]] || fund "Commit $kurz" "Committer ist $committer"
  git show -s --format='%B' "$commit" | pruefe_text "Commit $kurz"
  if [[ $FUNDE -gt $vorher ]]; then HISTORIE=1; fi
done < <(git rev-list --all)

while IFS=$'\t' read -r tag typ; do
  [[ -z "$tag" ]] && continue
  [[ "$typ" == "tag" ]] || continue # leichte Tags haben weder Text noch Tagger
  vorher=$FUNDE
  tagger="$(git for-each-ref --format='%(taggername) %(taggeremail)' "refs/tags/$tag")"
  [[ "$tagger" == "$ERLAUBT_IDENTITAET" ]] || fund "Tag $tag" "Tagger ist $tagger"
  git for-each-ref --format='%(contents)' "refs/tags/$tag" | pruefe_text "Tag $tag"
  if [[ $FUNDE -gt $vorher ]]; then HISTORIE=1; fi
done < <(git for-each-ref --format='%(refname:short)%09%(objecttype)' refs/tags)

if git log --all --format=%h -- muebs.md | grep -q .; then
  fund "Historie" "muebs.md wurde committet"
  HISTORIE=1
fi

# ---------- 2. Dateien im Arbeitsverzeichnis ----------
mapfile -t DATEIEN < <(git ls-files --cached --others --exclude-standard | grep -vxF "$SELBST" || true)

for datei in "${DATEIEN[@]}"; do
  [[ -f "$datei" ]] || continue
  [[ "$datei" == "muebs.md" ]] && fund "$datei" "internes Dokument liegt im Repo"
  grep -Iq . "$datei" 2>/dev/null || continue # leer oder binär
  if [[ $FIX -eq 1 ]] && grep -qiE "$SITZUNG|$MITAUTOR" "$datei"; then
    sed -i -E '/^[[:space:]]*[Cc][Oo]-[Aa][Uu][Tt][Hh][Oo][Rr][Ee][Dd]-[Bb][Yy]:/d; /Claude-Session:/d; s#https?://claude\.ai/code/session_[A-Za-z0-9_-]*##g' "$datei"
    echo "BEREINIGT $datei"
  fi
  pruefe_text "$datei" <"$datei"
done

# ---------- 3. Zweite Linie: App-Code lädt nichts von außen ----------
mapfile -t APP < <(printf '%s\n' "${DATEIEN[@]}" | grep -E '^(index\.html|sw\.js|manifest\.webmanifest|js/.*\.js|css/.*\.css)$' || true)

for datei in "${APP[@]}"; do
  [[ -f "$datei" ]] || continue
  while IFS= read -r url; do
    [[ -z "$url" ]] && continue
    grep -qE "$ERLAUBTE_URLS" <<<"$url" || fund "$datei" "externe URL $url"
  done < <(grep -oE "https?://[^\"'\`[:space:])<>]+" "$datei" || true)
  while IFS= read -r treffer; do
    [[ -n "$treffer" ]] && fund "$datei" "verbotene Anfrage oder Senke: $treffer"
  done < <(grep -nE "(src|href)=[\"']//|XMLHttpRequest|sendBeacon|WebSocket|EventSource|new[[:space:]]+(Shared)?Worker|(^|[^.{[:alnum:]_])import[[:space:]]*\(|rel=[\"'](preconnect|prefetch|dns-prefetch)|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|(^|[^.[:alnum:]_])eval[[:space:]]*\(|new[[:space:]]+Function|set(Timeout|Interval)[[:space:]]*\([[:space:]]*[\"'\`]" "$datei" || true)
  while IFS= read -r treffer; do
    [[ -n "$treffer" ]] && fund "$datei" "fetch nur auf eigene App-Dateien: $treffer"
  done < <(grep -nE "fetch[[:space:]]*\(" "$datei" | grep -vE "fetch\('(demo/demo\.json|version\.json)'|fetch\(e\.request\)" || true)
  if [[ "$datei" == *.css ]]; then
    while IFS= read -r treffer; do
      [[ -n "$treffer" ]] && fund "$datei" "url() in CSS: $treffer"
    done < <(grep -nE "url[[:space:]]*\(" "$datei" || true)
  fi
done

# ---------- Ergebnis ----------
if [[ $HISTORIE -eq 1 ]]; then
  cat <<'ANLEITUNG'

Die Git-Historie enthält Verstöße. Sie wird nie automatisch umgeschrieben.
So bereinigt die verantwortliche Person die Historie von Hand:
  1. GitHub-Profilname und Git-Identität auf creo08 und die noreply-Adresse setzen.
  2. Betroffene Branches lokal neu schreiben, z. B. mit git filter-repo (--mailmap für
     Autor/Committer, --message-callback für Trailer und Sitzungs-Links) oder git rebase.
  3. Ergebnis mit scripts/cleanup.sh prüfen, dann mit git push --force-with-lease
     veröffentlichen (bei main vorher den Branch-Schutz kurz lockern).
  4. Betroffene Tags neu setzen und alle Klone neu holen lassen.
ANLEITUNG
fi

if [[ $FUNDE -gt 0 ]]; then
  echo "cleanup.sh: $FUNDE Fund(e)."
  exit 1
fi
echo "cleanup.sh: keine Funde."
