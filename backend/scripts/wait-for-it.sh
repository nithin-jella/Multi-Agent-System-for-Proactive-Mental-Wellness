#!/usr/bin/env bash
# wait-for-it.sh: wait for a host and port to be available before executing a command.
#
# Author: Gilles Fabre
# License: MIT
# Version: 2.2.3

set -e

TIMEOUT=15
QUIET=0
HOST=
PORT=

usage() {
    cat << USAGE >&2
Usage:
    $0 host:port [-s] [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
                                Alternatively, you can specify the host and port as host:port
    -s | --strict               Only execute subcommand if the test succeeds
    -q | --quiet                Don't output any status messages
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for() {
    if [ $TIMEOUT -gt 0 ]; then
        echo "Waiting $TIMEOUT seconds for $HOST:$PORT"
    else
        echo "Waiting for $HOST:$PORT without timeout"
    fi
    start_ts=$(date +%s)
    while :
    do
        if [ $QUIET -eq 0 ]; then
            (echo > /dev/tcp/$HOST/$PORT) >/dev/null 2>&1
            result=$?
        else
            (echo > /dev/tcp/$HOST/$PORT) 2>/dev/null
            result=$?
        fi
        if [ $result -eq 0 ]; then
            end_ts=$(date +%s)
            if [ $QUIET -eq 0 ]; then echo "$HOST:$PORT is available after $((end_ts - start_ts)) seconds"; fi
            break
        fi
        sleep 1
        now_ts=$(date +%s)
        if [ $TIMEOUT -gt 0 ] && [ $((now_ts - start_ts)) -ge $TIMEOUT ]; then
            echo "Timeout occurred after waiting $TIMEOUT seconds for $HOST:$PORT" >&2
            exit 1
        fi
    done
    exec "$@"
}

while [ $# -gt 0 ]
do
    case "$1" in
        *:* )
        HOST=$(printf "%s\n" "$1"| cut -d : -f 1)
        PORT=$(printf "%s\n" "$1"| cut -d : -f 2)
        shift 1
        ;;
        -q | --quiet)
        QUIET=1
        shift 1
        ;;
        -s | --strict)
        STRICT=1
        shift 1
        ;;
        -h)
        HOST="$2"
        if [ "$HOST" = "" ]; then break; fi
        shift 2
        ;;
        --host=*)
        HOST="${1#*=}"
        shift 1
        ;;
        -p)
        PORT="$2"
        if [ "$PORT" = "" ]; then break; fi
        shift 2
        ;;
        --port=*)
        PORT="${1#*=}"
        shift 1
        ;;
        -t)
        TIMEOUT="$2"
        if [ "$TIMEOUT" = "" ]; then break; fi
        shift 2
        ;;
        --timeout=*)
        TIMEOUT="${1#*=}"
        shift 1
        ;;
        --)
        shift
        CLI=("$@")
        break
        ;;
        --help)
        usage
        ;;
        *)
        echo "Unknown argument: $1" >&2
        usage
        ;;
    esac
done

if [ "$HOST" = "" ] || [ "$PORT" = "" ]; then
    echo "Error: you need to provide a host and port to test." >&2
    usage
fi

wait_for "${CLI[@]}"