#!/usr/bin/env bash
# 김포국악원 프로젝트 - Bash 설정 스크립트
# 사용: bash scripts/setup.sh (또는 Git Bash / WSL에서 ./scripts/setup.sh)

set -e
cd "$(dirname "$0")/.."

echo "Installing dependencies..."
npm install

if [[ ! -f .env.local ]]; then
  echo "Creating .env.local from template..."
  cp .env.local.example .env.local
  echo "Edit .env.local with your Supabase URL, anon key, and contact info."
fi

echo "Done. Run: npm run dev"
