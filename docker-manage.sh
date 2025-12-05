#!/bin/bash

# ===========================================
# Docker Management Script
# Admin Telegram Panel
# ===========================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Директория проекта
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Функция вывода сообщений
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Проверка Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker не установлен!"
        exit 1
    fi
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose не установлен!"
        exit 1
    fi
}

# Функция для docker-compose (совместимость с v1 и v2)
docker_compose() {
    if docker compose version &> /dev/null; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

# Сборка frontend
build_frontend() {
    log_info "Сборка frontend..."
    cd "$PROJECT_DIR/frontend"
    npm run build
    
    # Проверяем что сборка создана
    if [ -d "dist" ]; then
        log_success "Frontend собран"
    else
        log_error "Директория dist не найдена!"
        exit 1
    fi
    cd "$PROJECT_DIR"
}

# Запуск
start() {
    log_info "Запуск всех сервисов..."
    docker_compose up -d
    log_success "Сервисы запущены"
    status
}

# Остановка
stop() {
    log_info "Остановка всех сервисов..."
    docker_compose down
    log_success "Сервисы остановлены"
}

# Перезапуск
restart() {
    log_info "Перезапуск всех сервисов..."
    docker_compose restart
    log_success "Сервисы перезапущены"
}

# Статус
status() {
    log_info "Статус сервисов:"
    echo ""
    docker_compose ps
    echo ""
    log_info "Здоровье контейнеров:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep admin_telegram || true
}

# Логи
logs() {
    local service=${1:-}
    if [ -n "$service" ]; then
        docker_compose logs -f "$service"
    else
        docker_compose logs -f
    fi
}

# Сборка и запуск
build() {
    log_info "Сборка Docker образов..."
    
    # Сначала собираем frontend
    build_frontend
    
    # Собираем Docker образы
    docker_compose build --no-cache
    log_success "Образы собраны"
}

# Полный деплой
deploy() {
    log_info "Начинаем деплой..."
    
    # Останавливаем старые контейнеры
    docker_compose down || true
    
    # Собираем frontend
    build_frontend
    
    # Собираем и запускаем
    docker_compose up -d --build
    
    # Ждем запуска
    log_info "Ожидание запуска сервисов..."
    sleep 10
    
    # Проверяем статус
    status
    
    log_success "Деплой завершен!"
}

# Обновление без простоя (rolling update)
update() {
    log_info "Обновление сервисов без простоя..."
    
    # Собираем frontend
    build_frontend
    
    # Пересобираем образы
    docker_compose build
    
    # Обновляем backend
    log_info "Обновление backend..."
    docker_compose up -d --no-deps --build backend
    
    # Ждем пока backend станет healthy
    log_info "Ожидание готовности backend..."
    sleep 30
    
    # Обновляем frontend
    log_info "Обновление frontend..."
    docker_compose up -d --no-deps --build frontend
    
    log_success "Обновление завершено!"
    status
}

# Очистка
cleanup() {
    log_warning "Очистка неиспользуемых Docker ресурсов..."
    docker system prune -f
    docker volume prune -f
    log_success "Очистка завершена"
}

# Бэкап базы данных
backup_db() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    log_info "Создание бэкапа базы данных: $backup_file"
    
    docker exec admin_telegram_db pg_dump -U postgres admin_telegram > "$backup_file"
    
    if [ -f "$backup_file" ]; then
        log_success "Бэкап создан: $backup_file"
        ls -lh "$backup_file"
    else
        log_error "Ошибка создания бэкапа"
        exit 1
    fi
}

# Восстановление базы данных
restore_db() {
    local backup_file=${1:-}
    if [ -z "$backup_file" ]; then
        log_error "Укажите файл бэкапа: ./docker-manage.sh restore_db backup.sql"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Файл не найден: $backup_file"
        exit 1
    fi
    
    log_warning "Восстановление базы данных из: $backup_file"
    log_warning "ВСЕ ДАННЫЕ БУДУТ ПЕРЕЗАПИСАНЫ!"
    read -p "Продолжить? (y/N): " confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        cat "$backup_file" | docker exec -i admin_telegram_db psql -U postgres admin_telegram
        log_success "База данных восстановлена"
    else
        log_info "Отменено"
    fi
}

# Проверка здоровья
health() {
    log_info "Проверка здоровья сервисов..."
    echo ""
    
    # PostgreSQL
    if docker exec admin_telegram_db pg_isready -U postgres -d admin_telegram &> /dev/null; then
        log_success "PostgreSQL: OK"
    else
        log_error "PostgreSQL: FAIL"
    fi
    
    # Backend
    if curl -sf http://localhost:3000/api/broadcasts/test &> /dev/null; then
        log_success "Backend: OK"
    else
        log_error "Backend: FAIL"
    fi
    
    # Frontend
    if curl -sf http://localhost:4000 &> /dev/null; then
        log_success "Frontend: OK"
    else
        log_error "Frontend: FAIL"
    fi
    
    echo ""
}

# Помощь
help() {
    echo ""
    echo "=========================================="
    echo "  Admin Telegram Panel - Docker Manager"
    echo "=========================================="
    echo ""
    echo "Использование: ./docker-manage.sh [команда]"
    echo ""
    echo "Команды:"
    echo "  start       - Запуск всех сервисов"
    echo "  stop        - Остановка всех сервисов"
    echo "  restart     - Перезапуск всех сервисов"
    echo "  status      - Статус сервисов"
    echo "  logs [srv]  - Просмотр логов (опционально: backend/frontend/postgres)"
    echo "  build       - Сборка Docker образов"
    echo "  deploy      - Полный деплой (остановка + сборка + запуск)"
    echo "  update      - Обновление без простоя"
    echo "  cleanup     - Очистка неиспользуемых ресурсов"
    echo "  backup_db   - Бэкап базы данных"
    echo "  restore_db  - Восстановление базы данных"
    echo "  health      - Проверка здоровья сервисов"
    echo "  help        - Показать эту справку"
    echo ""
}

# Проверка Docker
check_docker

# Обработка команд
case "${1:-help}" in
    start)      start ;;
    stop)       stop ;;
    restart)    restart ;;
    status)     status ;;
    logs)       logs "$2" ;;
    build)      build ;;
    deploy)     deploy ;;
    update)     update ;;
    cleanup)    cleanup ;;
    backup_db)  backup_db ;;
    restore_db) restore_db "$2" ;;
    health)     health ;;
    help|*)     help ;;
esac

