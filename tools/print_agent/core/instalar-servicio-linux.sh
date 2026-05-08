#!/bin/bash
# Instala el agente como servicio systemd para que arranque al boot
# y se reinicie solo si se cae.
#
# Uso (desde la carpeta core/):
#   sudo ./instalar-servicio-linux.sh        # instala bajo el usuario actual
#   sudo ./instalar-servicio-linux.sh cajero # instala bajo el usuario 'cajero'
#
# Después del install:
#   systemctl status atlas-print-agent
#   journalctl -u atlas-print-agent -f     # logs en vivo
#   sudo systemctl restart atlas-print-agent

set -e

CORE_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$(cd "$CORE_DIR/.." && pwd)"
SERVICE_TEMPLATE="$CORE_DIR/atlas-print-agent.service"
TARGET_USER="${1:-$SUDO_USER}"
if [ -z "$TARGET_USER" ]; then
    TARGET_USER="$USER"
fi

if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] Este script debe correr con sudo."
    echo "        Ejecuta: sudo $0 [usuario]"
    exit 1
fi

if [ ! -f "$SERVICE_TEMPLATE" ]; then
    echo "[ERROR] No se encuentra $SERVICE_TEMPLATE"
    exit 1
fi

if ! id "$TARGET_USER" &>/dev/null; then
    echo "[ERROR] El usuario '$TARGET_USER' no existe."
    exit 1
fi

# Primer arranque manual para crear venv, certs y generar el bootstrap.
if [ ! -f "$CORE_DIR/venv/bin/python3" ]; then
    echo "[INFO] Venv no existe — corriendo bootstrap como usuario '$TARGET_USER'…"
    sudo -u "$TARGET_USER" bash "$AGENT_DIR/impresora_linux.sh" &
    BOOTSTRAP_PID=$!
    sleep 20
    # Si el bootstrap arrancó el agente, matarlo — systemd se hará cargo.
    kill "$BOOTSTRAP_PID" 2>/dev/null || true
    pkill -u "$TARGET_USER" -f "$CORE_DIR/main.py" 2>/dev/null || true
    echo "[OK] Bootstrap listo."
fi

# Renderiza el service file sustituyendo {WORKDIR} (= core/, donde vive main.py + venv).
TARGET_SERVICE="/etc/systemd/system/atlas-print-agent.service"
sed "s|{WORKDIR}|$CORE_DIR|g" "$SERVICE_TEMPLATE" \
    | sed "s|^User=%i|User=$TARGET_USER|" \
    | sed "s|^Group=%i|Group=$TARGET_USER|" \
    > "$TARGET_SERVICE"

systemctl daemon-reload
systemctl enable atlas-print-agent
systemctl restart atlas-print-agent

echo
echo "════════════════════════════════════════════════════════════"
echo "  Atlas Print Agent instalado como servicio systemd"
echo "  Usuario:    $TARGET_USER"
echo "  Directorio: $AGENT_DIR"
echo "════════════════════════════════════════════════════════════"
echo
echo "Comandos útiles:"
echo "  systemctl status atlas-print-agent"
echo "  journalctl -u atlas-print-agent -f    # logs en vivo"
echo "  sudo systemctl restart atlas-print-agent"
echo "  sudo systemctl disable --now atlas-print-agent   # desinstalar"
echo
