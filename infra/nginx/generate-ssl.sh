#!/bin/bash
# Генерує самопідписаний SSL сертифікат для nginx (dev/staging)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$SCRIPT_DIR/ssl"
mkdir -p "$SSL_DIR"
cd "$SSL_DIR"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout qms.key -out qms.crt \
  -subj "/CN=qms/O=QMS/C=UA"
chmod 644 qms.crt qms.key
echo "Сертифікати створено: $SSL_DIR/qms.crt, $SSL_DIR/qms.key"
