#!/bin/bash
#
# Перехоплення трафіку MediaSense за допомогою tcpdump
# Використання: sudo ./capture-mediasense-traffic.sh
#

set -e

echo "=========================================="
echo "Перехоплення трафіку MediaSense"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Перевірка прав
if [ "$EUID" -ne 0 ]; then 
    log_error "Потрібні права root. Запустіть: sudo $0"
    exit 1
fi

# Перевірка наявності tcpdump
if ! command -v tcpdump &> /dev/null; then
    log_error "tcpdump не встановлено. Встановіть: sudo apt-get install tcpdump"
    exit 1
fi

MEDIASENSE_IP="192.168.200.133"
MEDIASENSE_PORT="8440"
OUTPUT_FILE="mediasense-traffic-$(date +%Y%m%d-%H%M%S).pcap"

log_info "Початок перехоплення трафіку до $MEDIASENSE_IP:$MEDIASENSE_PORT"
log_info "Файл: $OUTPUT_FILE"
log_info ""
log_info "Тепер виконайте запити до MediaSense API"
log_info "Натисніть Ctrl+C для зупинки"
echo ""

# Перехоплення трафіку
tcpdump -i any -w "$OUTPUT_FILE" -s 0 host $MEDIASENSE_IP and port $MEDIASENSE_PORT &
TCPDUMP_PID=$!

# Очікування сигналу
trap "kill $TCPDUMP_PID 2>/dev/null; exit" INT TERM

wait $TCPDUMP_PID

log_info ""
log_info "Перехоплення завершено. Файл: $OUTPUT_FILE"
log_info ""
log_info "Для аналізу використайте:"
echo "  tcpdump -r $OUTPUT_FILE -A -s 0 | grep -i 'cookie\|authorization\|jsessionid'"
echo "  wireshark $OUTPUT_FILE"
echo ""
