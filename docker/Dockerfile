FROM php:8.4-fpm-alpine

# Build args untuk VITE (di-bake saat npm run build)
ARG VITE_REVERB_APP_KEY
ARG VITE_REVERB_HOST=localhost
ARG VITE_REVERB_PORT=80
ARG VITE_REVERB_SCHEME=http

# Jadikan tersedia sebagai env vars saat build
ENV VITE_REVERB_APP_KEY=$VITE_REVERB_APP_KEY \
    VITE_REVERB_HOST=$VITE_REVERB_HOST \
    VITE_REVERB_PORT=$VITE_REVERB_PORT \
    VITE_REVERB_SCHEME=$VITE_REVERB_SCHEME

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libxml2-dev \
    oniguruma-dev \
    sqlite \
    sqlite-dev \
    zip \
    unzip \
    nodejs \
    npm \
    git

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg && \
    docker-php-ext-install \
    pdo_mysql \
    pdo_sqlite \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy composer files first for layer caching
COPY composer.json composer.lock ./
RUN composer install --optimize-autoloader --no-dev --no-scripts

# Copy package files for layer caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy the rest of the project
COPY . .

# Buat .env minimal untuk npm run build
# VITE vars sudah di-inject via build args sebagai ENV
RUN echo "APP_NAME=Laravel" > .env && \
    echo "VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY}" >> .env && \
    echo "VITE_REVERB_HOST=${VITE_REVERB_HOST}" >> .env && \
    echo "VITE_REVERB_PORT=${VITE_REVERB_PORT}" >> .env && \
    echo "VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME}" >> .env

# Run composer scripts now that full project is available
RUN composer run-script post-autoload-dump || true

# Build frontend assets
RUN npm run build

# Copy configs
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache && \
    chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Expose HTTP and Reverb WebSocket
EXPOSE 80 8080

ENTRYPOINT ["/entrypoint.sh"]
