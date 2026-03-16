#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# ── Ensure git repo exists ────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
fi

# ── Ensure remote origin is set ───────────────────────────────────────────────
if ! git remote get-url origin &>/dev/null; then
  echo "No remote 'origin' found."
  read -rp "Enter your GitHub repo URL (e.g. https://github.com/user/repo.git): " REMOTE_URL
  git remote add origin "$REMOTE_URL"
  echo "Remote origin set to: $REMOTE_URL"
fi

# ── Determine default branch ──────────────────────────────────────────────────
DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}')
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
fi

# ── Stage, commit, and push ───────────────────────────────────────────────────
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

git add -A
git diff --cached --quiet && { echo "Nothing to commit."; exit 0; }
git commit -m "Backup: $TIMESTAMP"
git push -u origin "$DEFAULT_BRANCH"

echo "✓ Backup complete → $DEFAULT_BRANCH ($TIMESTAMP)"
