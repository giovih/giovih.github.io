#!/usr/bin/env bash
# Installazione automatica di BotLab su un server Ubuntu (es. Oracle Cloud Free).
# Uso:  curl -fsSL https://raw.githubusercontent.com/giovih/giovih.github.io/main/botlab/install.sh | bash
set -euo pipefail

REPO="https://github.com/giovih/giovih.github.io.git"
BRANCH="${BRANCH:-main}"
DIR="$HOME/botlab"
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

say "Installo Docker (se manca)"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo apt-get install -y git >/dev/null 2>&1 || true

say "Apro le porte 80 e 443 nel firewall interno di Ubuntu"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT
done
if command -v netfilter-persistent >/dev/null; then sudo netfilter-persistent save >/dev/null 2>&1 || true; fi

say "Scarico BotLab"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"; fi
cd "$DIR/botlab"

if [ ! -f .env ]; then
  say "Configurazione"
  echo "Incolla la tua chiave API di Gemini (da https://aistudio.google.com/apikey):"
  read -r GEMINI_API_KEY </dev/tty
  echo "Scegli una password per entrare nell'app:"
  read -r BOTLAB_PASSWORD </dev/tty
  IP=$(curl -fsS https://api.ipify.org)
  DOMAIN="${IP//./-}.sslip.io"
  cat > .env <<ENV
GEMINI_API_KEY=$GEMINI_API_KEY
BOTLAB_PASSWORD=$BOTLAB_PASSWORD
GEMINI_MODEL=gemini-2.5-flash
DOMAIN=$DOMAIN
BOT_MEMORY=1g
BOT_CPUS=1
ENV
  chmod 600 .env
fi
DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)

say "Preparo il mini PC dei bot (qualche minuto la prima volta)"
sudo docker build -t botlab-sandbox ./sandbox

say "Avvio BotLab"
sudo docker compose up -d --build

say "Fatto! 🎉"
echo "Apri sul telefono o sul PC:  https://$DOMAIN"
echo "(Se non si apre subito, aspetta 1 minuto: sta creando il certificato HTTPS.)"
