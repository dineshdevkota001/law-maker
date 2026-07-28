#! /bin/sh

has_python3_12=$(command -v python3.12)

if [ -n "$has_python3_12" ]; then
    python3.12 -m venv .venv
    python3.12 -m pip install -r requirements.txt
else
    echo "Python 3.12 not found but is preferred, using default python3"
    python3 -m venv .venv
    python3 -m pip install -r requirements.txt
fi