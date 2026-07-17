@echo off
uvicorn src.main:app --host 0.0.0.0 --port 8080 --reload --reload-dir . --log-level info

pause
