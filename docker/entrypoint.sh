#!/bin/sh
set -e

cd /var/www/html

# Buat .env dari environment variables kalau belum ada
if [ ! -f .env ]; then
    echo "APP_NAME=${APP_NAME:-Laravel}" > .env
    echo "APP_ENV=${APP_ENV:-production}" >> .env
    echo "APP_KEY=${APP_KEY:-}" >> .env
    echo "APP_DEBUG=${APP_DEBUG:-false}" >> .env
    echo "APP_URL=${APP_URL:-http://localhost}" >> .env
    echo "" >> .env
    echo "LOG_CHANNEL=${LOG_CHANNEL:-stderr}" >> .env
    echo "LOG_LEVEL=${LOG_LEVEL:-warning}" >> .env
    echo "" >> .env
    echo "DB_CONNECTION=${DB_CONNECTION:-sqlite}" >> .env
    echo "DB_DATABASE=${DB_DATABASE:-/var/www/html/database/database.sqlite}" >> .env
    echo "" >> .env
    echo "SESSION_DRIVER=${SESSION_DRIVER:-database}" >> .env
    echo "SESSION_LIFETIME=${SESSION_LIFETIME:-120}" >> .env
    echo "" >> .env
    echo "BROADCAST_CONNECTION=${BROADCAST_CONNECTION:-reverb}" >> .env
    echo "QUEUE_CONNECTION=${QUEUE_CONNECTION:-database}" >> .env
    echo "CACHE_STORE=${CACHE_STORE:-database}" >> .env
    echo "" >> .env
    echo "REVERB_APP_ID=${REVERB_APP_ID:-}" >> .env
    echo "REVERB_APP_KEY=${REVERB_APP_KEY:-}" >> .env
    echo "REVERB_APP_SECRET=${REVERB_APP_SECRET:-}" >> .env
    echo "REVERB_HOST=${REVERB_HOST:-0.0.0.0}" >> .env
    echo "REVERB_PORT=${REVERB_PORT:-8080}" >> .env
    echo "REVERB_SCHEME=${REVERB_SCHEME:-http}" >> .env
    echo "" >> .env
    echo "VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY:-${REVERB_APP_KEY:-}}" >> .env
    echo "VITE_REVERB_HOST=${VITE_REVERB_HOST:-localhost}" >> .env
    echo "VITE_REVERB_PORT=${VITE_REVERB_PORT:-80}" >> .env
    echo "VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME:-http}" >> .env
fi

# Generate app key kalau belum ada atau kosong
if [ -z "$APP_KEY" ] || grep -q "APP_KEY=$" .env; then
    php artisan key:generate --force
fi

# Ensure SQLite database file exists
if [ "${DB_CONNECTION:-sqlite}" = "sqlite" ]; then
    DB_FILE="${DB_DATABASE:-/var/www/html/database/database.sqlite}"
    if [ ! -f "$DB_FILE" ]; then
        touch "$DB_FILE"
        echo "Created SQLite database at $DB_FILE"
    fi
    # Pastikan www-data bisa baca dan tulis file + folder-nya
    chown www-data:www-data "$DB_FILE"
    chown www-data:www-data "$(dirname $DB_FILE)"
    chmod 664 "$DB_FILE"
    chmod 775 "$(dirname $DB_FILE)"
fi

# Run migrations
php artisan migrate --force

# Cache config & routes untuk production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Fix permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

exec /usr/bin/supervisord -c /etc/supervisord.conf
