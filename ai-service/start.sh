#!/bin/sh
set -e

if [ "${TRAIN_MODEL_ON_START:-false}" = "true" ] && [ ! -f "models/risk_model.keras" ]; then
  python scripts/generate_demo_data.py --rows "${TRAINING_ROWS:-5000}"
  python scripts/train_risk_model.py --epochs "${TRAINING_EPOCHS:-80}"
fi

exec uvicorn main:app --host 0.0.0.0 --port 8001
