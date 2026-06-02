# SWP1 AI Prediction Service

Servicio Python para predecir riesgo, ruta recomendada y mejoras de un tramite.

## Ejecutar en local

```powershell
cd D:\swp1-main\ai-service
py -3.10 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

Si quieres activar TensorFlow en Python:

```powershell
.\.venv\Scripts\python -m pip install -r requirements-tensorflow.txt
```

## Entrenar el modelo de riesgo

Primero genera datos de entrenamiento demo:

```powershell
cd D:\swp1-main
.\ai-service\.venv\Scripts\python ai-service\scripts\generate_demo_data.py --rows 800
```

Luego entrena con un entorno que tenga TensorFlow instalado:

```powershell
.\ai-service\.venv-tf\Scripts\python ai-service\scripts\train_risk_model.py --epochs 180
```

El entrenamiento crea:

```text
ai-service/models/risk_model.keras
ai-service/models/risk_model_metadata.json
```

Si el servicio ya esta levantado, recarga el modelo sin reiniciar:

```powershell
Invoke-RestMethod -Method Post http://localhost:8001/reload-model
```

El backend Spring Boot llama por defecto a:

```text
http://localhost:8001/predict
```

Puedes cambiarlo con la variable `AI_PREDICTION_URL`.
