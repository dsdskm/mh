#!/usr/bin/env sh
set -eu

# DB 터널 실행 스크립트.
# - Cloud SQL: cloud-sql-proxy 사용
# - VM PostgreSQL: gcloud compute ssh -L 사용
# 기본은 auto 모드이며, Cloud SQL 인스턴스가 없으면 VM 터널로 자동 전환한다.

INSTANCE_CONNECTION_NAME="${INSTANCE_CONNECTION_NAME:-corn-fbaae:asia-northeast3:corn-db-instance}"
LOCAL_PORT="${LOCAL_PORT:-5432}"
ADC_FILE_DEFAULT="${HOME}/.config/gcloud/application_default_credentials.json"
TUNNEL_MODE="${TUNNEL_MODE:-auto}" # auto | cloudsql | vm
AUTO_KILL_LOCAL_PORT="${AUTO_KILL_LOCAL_PORT:-1}" # 0 | 1
KILL_PORT_SCOPE="${KILL_PORT_SCOPE:-ssh}" # ssh | all
VM_NAME_DEFAULT="${VM_NAME:-corn-vm-instance}"
VM_ZONE_DEFAULT="${VM_ZONE:-asia-northeast3-a}"
REMOTE_DB_HOST="${REMOTE_DB_HOST:-localhost}"
REMOTE_DB_PORT="${REMOTE_DB_PORT:-5432}"
PROXY_BIN=""
PROXY_IS_LEGACY="0"

kill_port_listeners() {
	if ! command -v lsof >/dev/null 2>&1; then
		return 1
	fi

	case "$KILL_PORT_SCOPE" in
		ssh)
			pids="$(lsof -tiTCP:"$LOCAL_PORT" -sTCP:LISTEN -a -c ssh 2>/dev/null | sort -u || true)"
			;;
		all)
			pids="$(lsof -tiTCP:"$LOCAL_PORT" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
			;;
		*)
			echo "[db-tunnel] KILL_PORT_SCOPE 값이 올바르지 않습니다: $KILL_PORT_SCOPE" >&2
			echo "[db-tunnel] 허용 값: ssh | all" >&2
			return 1
			;;
	esac

	if [ -z "$pids" ]; then
		return 1
	fi

	echo "[db-tunnel] 포트 $LOCAL_PORT 점유 프로세스를 종료합니다. (scope=$KILL_PORT_SCOPE, pids=$pids)" >&2
	# shellcheck disable=SC2086
	kill $pids >/dev/null 2>&1 || true
	return 0
}

check_local_port_available() {
	if ! command -v lsof >/dev/null 2>&1; then
		return 0
	fi

	listeners="$(lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN 2>/dev/null || true)"
	if [ -n "$listeners" ] && [ "$AUTO_KILL_LOCAL_PORT" = "1" ]; then
		if ! kill_port_listeners; then
			echo "[db-tunnel] 자동 종료할 프로세스를 찾지 못했거나 종료에 실패했습니다." >&2
		fi
		listeners="$(lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN 2>/dev/null || true)"
	fi

	if [ -z "$listeners" ]; then
		return 0
	fi

	echo "[db-tunnel] 로컬 포트 $LOCAL_PORT 가 이미 사용 중입니다." >&2
	echo "$listeners" >&2
	echo "[db-tunnel] 해결 방법:" >&2
	echo "  1) 이미 열린 터널/DB를 그대로 사용" >&2
	echo "  2) 다른 포트로 실행 (예: LOCAL_PORT=15432 sh ./scripts/db/db-tunnel.sh)" >&2
	echo "  3) 점유 프로세스 종료 후 재실행" >&2
	echo "  4) 자동 종료 옵션 사용 (예: AUTO_KILL_LOCAL_PORT=1 KILL_PORT_SCOPE=ssh sh ./scripts/db/db-tunnel.sh)" >&2
	exit 1
}

has_adc_credentials() {
	if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -r "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then
		return 0
	fi

	if [ -r "$ADC_FILE_DEFAULT" ]; then
		return 0
	fi

	return 1
}

parse_connection_name() {
	project_id="${INSTANCE_CONNECTION_NAME%%:*}"
	remainder="${INSTANCE_CONNECTION_NAME#*:}"
	region="${remainder%%:*}"
	instance_name="${INSTANCE_CONNECTION_NAME##*:}"

	if [ -z "$project_id" ] || [ -z "$region" ] || [ -z "$instance_name" ] || [ "$project_id" = "$INSTANCE_CONNECTION_NAME" ] || [ "$remainder" = "$INSTANCE_CONNECTION_NAME" ]; then
		echo "[db-tunnel] INSTANCE_CONNECTION_NAME 형식이 올바르지 않습니다: $INSTANCE_CONNECTION_NAME" >&2
		echo "[db-tunnel] 예시: my-project:asia-northeast3:my-instance" >&2
		exit 1
	fi
}

is_connection_name_format() {
	case "$INSTANCE_CONNECTION_NAME" in
		*:*:*) return 0 ;;
		*) return 1 ;;
	esac
}

cloud_sql_instance_exists() {
	if ! command -v gcloud >/dev/null 2>&1; then
		return 1
	fi

	if [ "${SKIP_INSTANCE_CHECK:-0}" = "1" ]; then
		return 0
	fi

	if gcloud sql instances describe "$instance_name" --project "$project_id" >/dev/null 2>&1; then
		return 0
	fi

	return 1
}

print_cloud_sql_not_found_message() {

	echo "[db-tunnel] Cloud SQL 인스턴스를 찾지 못했습니다 (404)." >&2
	echo "[db-tunnel] 확인한 연결명: $INSTANCE_CONNECTION_NAME" >&2
	echo "[db-tunnel] 점검 명령:" >&2
	echo "  gcloud sql instances list --project $project_id" >&2
	echo "[db-tunnel] VM 내 PostgreSQL 터널 명령:" >&2
	echo "  gcloud compute ssh $VM_NAME_DEFAULT --zone $VM_ZONE_DEFAULT -- -N -L $LOCAL_PORT:$REMOTE_DB_HOST:$REMOTE_DB_PORT" >&2
	echo "[db-tunnel] 또는 올바른 인스턴스로 재실행:" >&2
	echo "  INSTANCE_CONNECTION_NAME=<project:region:instance> sh ./scripts/db/db-tunnel.sh" >&2
}

start_vm_tunnel() {
	if ! command -v gcloud >/dev/null 2>&1; then
		echo "[db-tunnel] gcloud 명령을 찾지 못했습니다. VM 터널을 위해 gcloud 설치가 필요합니다." >&2
		exit 127
	fi

	check_local_port_available

	echo "[db-tunnel] VM SSH 터널을 시작합니다." >&2
	echo "[db-tunnel] vm=$VM_NAME_DEFAULT zone=$VM_ZONE_DEFAULT local=$LOCAL_PORT remote=$REMOTE_DB_HOST:$REMOTE_DB_PORT" >&2
	exec gcloud compute ssh "$VM_NAME_DEFAULT" --zone "$VM_ZONE_DEFAULT" -- -N -L "$LOCAL_PORT:$REMOTE_DB_HOST:$REMOTE_DB_PORT"
}

start_cloud_sql_tunnel() {
	parse_connection_name

	if ! has_adc_credentials; then
		echo "[db-tunnel] Google ADC(Application Default Credentials)를 찾지 못했습니다." >&2
		echo "[db-tunnel] 아래 중 하나를 먼저 실행하세요:" >&2
		echo "  gcloud auth application-default login" >&2
		echo "  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json" >&2
		exit 1
	fi

	if ! cloud_sql_instance_exists; then
		print_cloud_sql_not_found_message
		exit 1
	fi

	if command -v cloud-sql-proxy >/dev/null 2>&1; then
		PROXY_BIN="$(command -v cloud-sql-proxy)"
	fi

	if [ -z "$PROXY_BIN" ] && command -v cloud_sql_proxy >/dev/null 2>&1; then
		PROXY_BIN="$(command -v cloud_sql_proxy)"
		PROXY_IS_LEGACY="1"
	fi

	if [ -z "$PROXY_BIN" ] && [ -x /opt/homebrew/bin/cloud-sql-proxy ]; then
		PROXY_BIN="/opt/homebrew/bin/cloud-sql-proxy"
	fi

	if [ -z "$PROXY_BIN" ] && [ -x /usr/local/bin/cloud-sql-proxy ]; then
		PROXY_BIN="/usr/local/bin/cloud-sql-proxy"
	fi

	if [ -z "$PROXY_BIN" ]; then
		echo "[db-tunnel] cloud-sql-proxy 실행 파일을 찾지 못했습니다." >&2
		echo "[db-tunnel] macOS(Homebrew) 설치:" >&2
		echo "  brew install cloud-sql-proxy" >&2
		echo "[db-tunnel] 또는 바이너리를 설치 후 PATH에 추가하세요." >&2
		echo "[db-tunnel] 설치 확인:" >&2
		echo "  cloud-sql-proxy --version" >&2
		exit 127
	fi

	check_local_port_available

	if [ "$PROXY_IS_LEGACY" = "1" ]; then
		exec "$PROXY_BIN" -instances="$INSTANCE_CONNECTION_NAME"=tcp:"$LOCAL_PORT"
	fi

	exec "$PROXY_BIN" "$INSTANCE_CONNECTION_NAME" --port "$LOCAL_PORT"
}

case "$TUNNEL_MODE" in
	vm)
		start_vm_tunnel
		;;
	cloudsql)
		start_cloud_sql_tunnel
		;;
	auto)
		if is_connection_name_format; then
			parse_connection_name
		fi
		if is_connection_name_format && cloud_sql_instance_exists; then
			start_cloud_sql_tunnel
		fi
		echo "[db-tunnel] auto 모드: Cloud SQL 대신 VM 터널로 전환합니다." >&2
		start_vm_tunnel
		;;
	*)
		echo "[db-tunnel] TUNNEL_MODE 값이 올바르지 않습니다: $TUNNEL_MODE" >&2
		echo "[db-tunnel] 허용 값: auto | cloudsql | vm" >&2
		exit 1
		;;
esac
