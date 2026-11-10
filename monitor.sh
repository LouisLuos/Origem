#!/bin/bash
# ==============================================================================
# monitor.sh — Script de Monitoramento de Recursos para Amazon Linux 2023
# Projeto Integrador: AED + Infraestrutura de Software (CESAR School)
#
# A cada 5 segundos:
#   - Exibe uso de CPU, Memória e Disco
#   - Exibe os 5 processos que mais consomem CPU/Memória
#   - Imprime no terminal e registra em 'monitor.log' com data e hora (timestamp)
# ==============================================================================

set -o pipefail

LOG_FILE="monitor.log"
INTERVALO=5

# Trata encerramento gracioso (Ctrl+C / SIGTERM)
encerrar() {
    echo "" | tee -a "$LOG_FILE"
    echo "================================================================================" | tee -a "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Monitoramento encerrado pelo usuário." | tee -a "$LOG_FILE"
    echo "================================================================================" | tee -a "$LOG_FILE"
    exit 0
}
trap encerrar SIGINT SIGTERM

echo "================================================================================" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando monitoramento no Amazon Linux 2023" | tee -a "$LOG_FILE"
echo "Arquivo de log: $LOG_FILE | Intervalo: ${INTERVALO}s" | tee -a "$LOG_FILE"
echo "Pressione [Ctrl+C] para interromper." | tee -a "$LOG_FILE"
echo "================================================================================" | tee -a "$LOG_FILE"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    # 1. Uso de CPU (calcula tempo ocioso 'id' e subtrai de 100%)
    if [ -f /proc/stat ]; then
        CPU_IDLE=$(top -bn1 | awk -F',' '/Cpu\(s\)/ {for(i=1;i<=NF;i++) if($i ~ /id/) {gsub(/[^0-9.]/,"",$i); print $i}}' | head -n1)
        if [ -n "$CPU_IDLE" ]; then
            CPU_USAGE=$(awk -v idle="$CPU_IDLE" 'BEGIN { printf "%.2f%%", 100 - idle }')
        else
            CPU_USAGE=$(top -bn1 | awk '/Cpu\(s\)/ {printf "%.2f%%", 100 - $8}')
        fi
    else
        CPU_USAGE="N/D"
    fi

    # 2. Uso de Memória RAM (total, usado e porcentagem via free)
    MEM_INFO=$(free -m | awk 'NR==2{printf "%s MB / %s MB (%.2f%%)", $3, $2, ($3*100)/$2}')

    # 3. Uso de Disco da partição raiz (via df)
    DISK_INFO=$(df -h / | awk 'NR==2{printf "%s / %s (%s utilizado)", $3, $2, $5}')

    # 4. Top 5 processos que mais consomem CPU
    TOP_PROCESSOS=$(ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 6)

    # Bloco estruturado formatado
    {
        echo "--------------------------------------------------------------------------------"
        echo "REGISTRO DE MONITORAMENTO — $TIMESTAMP"
        echo "--------------------------------------------------------------------------------"
        echo " [CPU]     Uso Total: $CPU_USAGE"
        echo " [MEMÓRIA] Uso de RAM: $MEM_INFO"
        echo " [DISCO]   Partição /: $DISK_INFO"
        echo ""
        echo " [PROCESSOS] Top 5 maiores consumidores de CPU:"
        echo "$TOP_PROCESSOS"
        echo ""
    } | tee -a "$LOG_FILE"

    sleep "$INTERVALO"
done

