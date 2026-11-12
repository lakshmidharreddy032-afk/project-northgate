#!/usr/bin/env bash
set -euo pipefail

echo "Running Project Northgate verification..."
python -m pytest backend/tests/ -v
(cd frontend && npm run build)
echo "Verification complete."
