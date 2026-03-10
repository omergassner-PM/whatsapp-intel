#!/bin/bash
# Backup the PostgreSQL database
# Usage: ./scripts/backup.sh [output_dir]

set -e

OUTPUT_DIR="${1:-.}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="aerodata_backup_${TIMESTAMP}.sql"

echo "Backing up database..."
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-intel}" "${POSTGRES_DB:-whatsapp_intel}" > "${OUTPUT_DIR}/${FILENAME}"
echo "Backup saved to: ${OUTPUT_DIR}/${FILENAME}"
echo ""
echo "To restore on another machine:"
echo "  1. Copy this file + the project folder to the new machine"
echo "  2. Run: docker compose up db -d"
echo "  3. Run: docker compose exec -T db psql -U intel whatsapp_intel < ${FILENAME}"
echo "  4. Run: docker compose up --build"
