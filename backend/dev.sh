#! /bin/sh

source .venv/bin/activate
python3 -m venv .venv
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000