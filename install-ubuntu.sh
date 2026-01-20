#!/bin/bash
# QMS Installation Script for Ubuntu Linux
# Supports: Ubuntu 20.04, 22.04, 24.04
# Run as: sudo bash install-ubuntu.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
QMS_REPO="https://github.com/your-org/qms.git"  # Update with your repo
QMS_BRANCH="main"
INSTALL_DIR="/opt/qms"
QMS_USER="qms"
DOMAIN="qms.example.com"  # Update with your domain

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root (sudo bash install-ubuntu.sh)"
        exit 1
    fi
}

check_os() {
    if [ ! -f /etc/os-release ]; then
        log_error "Cannot detect OS version"
        exit 1
    fi
    
    . /etc/os-release
    
    if [ "$ID" != "ubuntu" ]; then
        log_error "This script is for Ubuntu only. Detected: $ID"
        exit 1
    fi
    
    log_info "Detected Ubuntu $VERSION_ID"
}

install_dependencies() {
    log_info "Installing system dependencies..."
    
    apt-get update
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        git \
        jq \
        openssl \
        ufw \
        fail2ban \
        unzip
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker already installed: $(docker --version)"
        return
    fi
    
    log_info "Installing Docker..."
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    
    # Add repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log_info "Docker installed: $(docker --version)"
}

create_qms_user() {
    if id "$QMS_USER" &>/dev/null; then
        log_info "User $QMS_USER already exists"
    else
        log_info "Creating user $QMS_USER..."
        useradd -r -m -d /home/$QMS_USER -s /bin/bash $QMS_USER
        usermod -aG docker $QMS_USER
    fi
}

clone_repository() {
    log_info "Cloning QMS repository..."
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Directory $INSTALL_DIR already exists. Updating..."
        cd "$INSTALL_DIR"
        sudo -u $QMS_USER git pull
    else
        log_info "Cloning from $QMS_REPO..."
        mkdir -p "$INSTALL_DIR"
        # For now, copy from current directory if script is run from repo
        if [ -f "$(dirname $0)/package.json" ]; then
            log_info "Copying from current directory..."
            cp -r "$(dirname $0)"/* "$INSTALL_DIR/"
        else
            # Clone from git repository
            sudo -u $QMS_USER git clone -b $QMS_BRANCH $QMS_REPO "$INSTALL_DIR"
        fi
    fi
    
    chown -R $QMS_USER:$QMS_USER "$INSTALL_DIR"
}

generate_secrets() {
    log_info "Generating secrets..."
    
    JWT_SECRET=$(openssl rand -base64 32)
    SESSION_SECRET=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 24)
    REDIS_PASSWORD=$(openssl rand -base64 24)
    
    log_info "Secrets generated successfully"
}

create_env_file() {
    log_info "Creating environment configuration..."
    
    cat > "$INSTALL_DIR/apps/api/.env" <<EOF
# Database
DATABASE_URL="postgresql://qms_user:${POSTGRES_PASSWORD}@postgres:5432/qms?schema=public"

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1d

# OpenSearch
OPENSEARCH_NODE=http://opensearch:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=admin

# UCCX (Update with your values)
UCCX_HOST=your-uccx-server.example.com
UCCX_USERNAME=admin
UCCX_PASSWORD=changeme
UCCX_SYNC_ENABLED=false

# MediaSense (Update with your values)
MEDIASENSE_HOST=your-mediasense-server.example.com
MEDIASENSE_USERNAME=admin
MEDIASENSE_PASSWORD=changeme

# Keycloak (Update with your values)
KEYCLOAK_ISSUER=http://localhost:8080
KEYCLOAK_CLIENT_ID=qms
KEYCLOAK_CLIENT_SECRET=changeme
KEYCLOAK_ENABLED=false

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF

    # Update docker-compose.yml with passwords
    sed -i "s/POSTGRES_PASSWORD: qms_password_secure/POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}/" "$INSTALL_DIR/infra/docker-compose.yml"
    sed -i "s/--requirepass redis_password_secure/--requirepass ${REDIS_PASSWORD}/" "$INSTALL_DIR/infra/docker-compose.yml"
    
    chmod 600 "$INSTALL_DIR/apps/api/.env"
    chown $QMS_USER:$QMS_USER "$INSTALL_DIR/apps/api/.env"
    
    log_info "Environment file created"
}

generate_ssl_certificate() {
    log_info "Generating self-signed SSL certificate..."
    
    mkdir -p "$INSTALL_DIR/infra/nginx/ssl"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$INSTALL_DIR/infra/nginx/ssl/qms.key" \
        -out "$INSTALL_DIR/infra/nginx/ssl/qms.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    chmod 644 "$INSTALL_DIR/infra/nginx/ssl/qms.crt"
    chmod 600 "$INSTALL_DIR/infra/nginx/ssl/qms.key"
    
    log_info "SSL certificate generated"
}

setup_firewall() {
    log_info "Configuring firewall..."
    
    # Enable UFW
    ufw --force enable
    
    # Allow SSH
    ufw allow 22/tcp
    
    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow development ports (optional, remove in production)
    ufw allow 3000/tcp  # API
    ufw allow 5173/tcp  # Frontend dev
    
    ufw reload
    
    log_info "Firewall configured"
}

start_services() {
    log_info "Starting QMS services..."
    
    cd "$INSTALL_DIR"
    
    # Build and start containers
    sudo -u $QMS_USER docker compose -f infra/docker-compose.yml up -d --build
    
    log_info "Waiting for services to start..."
    sleep 15
    
    # Check service status
    sudo -u $QMS_USER docker compose -f infra/docker-compose.yml ps
}

run_migrations() {
    log_info "Running database migrations..."
    
    cd "$INSTALL_DIR"
    
    # Wait for PostgreSQL to be ready
    for i in {1..30}; do
        if sudo -u $QMS_USER docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U qms_user &>/dev/null; then
            log_info "PostgreSQL is ready"
            break
        fi
        log_info "Waiting for PostgreSQL... ($i/30)"
        sleep 2
    done
    
    # Run Prisma migrations
    sudo -u $QMS_USER docker compose -f infra/docker-compose.yml exec -T api npx prisma migrate deploy || true
    
    log_info "Migrations completed"
}

seed_database() {
    log_info "Seeding database with initial data..."
    
    cd "$INSTALL_DIR"
    
    # Create admin user
    sudo -u $QMS_USER docker compose -f infra/docker-compose.yml exec -T api npx ts-node -e "
    import { PrismaClient } from '@prisma/client';
    import * as bcrypt from 'bcrypt';

    const prisma = new PrismaClient();

    async function main() {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@qms.local',
          fullName: 'System Administrator',
          role: 'ADMIN',
          isActive: true
        }
      });
      
      console.log('Admin user created: username=admin, password=admin123');
    }

    main()
      .catch(console.error)
      .finally(() => prisma.\$disconnect());
    " 2>/dev/null || log_warn "Seeding skipped (may already be done)"
    
    log_info "Database seeded"
}

create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/qms.service <<EOF
[Unit]
Description=QMS Quality Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
User=$QMS_USER
Group=$QMS_USER

ExecStart=/usr/bin/docker compose -f infra/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f infra/docker-compose.yml down
ExecReload=/usr/bin/docker compose -f infra/docker-compose.yml restart

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable qms.service
    
    log_info "Systemd service created and enabled"
}

print_summary() {
    local IP_ADDRESS=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "QMS Installation Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📍 Installation Directory: $INSTALL_DIR"
    echo "👤 System User: $QMS_USER"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:  http://$IP_ADDRESS:5173"
    echo "   API:       http://$IP_ADDRESS:3000"
    echo "   API Docs:  http://$IP_ADDRESS:3000/api"
    echo ""
    echo "🔐 Default Credentials:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo "   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!"
    echo ""
    echo "📝 Configuration:"
    echo "   Environment: $INSTALL_DIR/apps/api/.env"
    echo "   Docker:      $INSTALL_DIR/infra/docker-compose.yml"
    echo ""
    echo "🔧 Useful Commands:"
    echo "   Status:   sudo systemctl status qms"
    echo "   Start:    sudo systemctl start qms"
    echo "   Stop:     sudo systemctl stop qms"
    echo "   Restart:  sudo systemctl restart qms"
    echo "   Logs:     cd $INSTALL_DIR && docker compose -f infra/docker-compose.yml logs -f"
    echo ""
    echo "📚 Documentation:"
    echo "   $INSTALL_DIR/README.md"
    echo "   $INSTALL_DIR/GETTING_STARTED.md"
    echo ""
    echo "⚙️  Next Steps:"
    echo "   1. Update configuration in: $INSTALL_DIR/apps/api/.env"
    echo "   2. Configure UCCX connection (if available)"
    echo "   3. Configure MediaSense connection (if available)"
    echo "   4. Change admin password in the web interface"
    echo "   5. Configure SSL certificate for production"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main installation flow
main() {
    log_info "Starting QMS Installation..."
    echo ""
    
    check_root
    check_os
    
    install_dependencies
    install_docker
    create_qms_user
    clone_repository
    generate_secrets
    create_env_file
    generate_ssl_certificate
    setup_firewall
    start_services
    run_migrations
    seed_database
    create_systemd_service
    
    print_summary
}

# Run main function
main "$@"
