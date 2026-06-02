from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

try:
    import tensorflow as tf  # type: ignore
except Exception:  # pragma: no cover - tensorflow is optional for local bootstrapping
    tf = None


app = FastAPI(title="SWP1 AI Prediction Service", version="0.1.0")

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "risk_model.keras"
METADATA_PATH = BASE_DIR / "models" / "risk_model_metadata.json"

_risk_model: Any = None
_model_metadata: dict[str, Any] | None = None
_model_load_attempted = False


class PredictionRequest(BaseModel):
    tramite: dict[str, Any] = Field(default_factory=dict)
    politica: dict[str, Any] = Field(default_factory=dict)
    currentNode: dict[str, Any] | None = None
    currentAssignees: list[str] = Field(default_factory=list)
    workloadByFuncionario: dict[str, int] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict[str, Any]:
    model, metadata = load_trained_model()
    return {
        "status": "ok",
        "tensorflow": bool(tf),
        "trainedModel": MODEL_PATH.exists(),
        "trainedModelLoaded": bool(model),
        "trainingRows": metadata.get("rows") if metadata else 0,
        "engine": active_engine(),
    }


@app.post("/reload-model")
def reload_model() -> dict[str, Any]:
    global _risk_model, _model_metadata, _model_load_attempted
    _risk_model = None
    _model_metadata = None
    _model_load_attempted = False
    model, metadata = load_trained_model()
    return {
        "reloaded": bool(model),
        "trainingRows": metadata.get("rows") if metadata else 0,
        "engine": active_engine(),
    }


@app.post("/predict")
def predict(payload: PredictionRequest) -> dict[str, Any]:
    tramite = payload.tramite
    politica = payload.politica
    current_node = payload.currentNode or find_node(politica, tramite.get("nodoActualId"))
    historial = list(tramite.get("historial") or [])

    features = build_features(
        tramite=tramite,
        politica=politica,
        current_node=current_node,
        historial=historial,
        current_assignees=payload.currentAssignees,
        workload=payload.workloadByFuncionario,
    )
    score = risk_score(features)
    risk_level = risk_label(score)
    route_options = next_route_options(politica, current_node)
    best_route = choose_best_route(route_options, payload.workloadByFuncionario, politica)

    return {
        "source": "python-ai-service",
        "engine": active_engine(),
        "riskLevel": risk_level,
        "riskScore": score,
        "estimatedDays": estimate_days(features, score),
        "recommendedRoute": best_route,
        "routeOptions": route_options,
        "motives": build_motives(features, risk_level),
        "improvements": build_improvements(features, best_route),
        "features": features,
    }


def load_trained_model() -> tuple[Any, dict[str, Any] | None]:
    global _risk_model, _model_metadata, _model_load_attempted

    if _model_load_attempted:
        return _risk_model, _model_metadata

    _model_load_attempted = True
    if not tf or not MODEL_PATH.exists() or not METADATA_PATH.exists():
        return None, None

    try:
        _risk_model = tf.keras.models.load_model(MODEL_PATH)
        _model_metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except Exception:
        _risk_model = None
        _model_metadata = None

    return _risk_model, _model_metadata


def active_engine() -> str:
    model, _ = load_trained_model()
    if model is not None:
        return "tensorflow-trained"
    if tf:
        return "tensorflow-formula"
    return "python-rules"


def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def elapsed_days(start: datetime | None, end: datetime | None = None) -> float:
    if not start:
        return 0.0
    finish = end or now_utc()
    return max((finish - start).total_seconds() / 86400.0, 0.0)


def find_node(politica: dict[str, Any], node_id: Any) -> dict[str, Any] | None:
    return next((node for node in politica.get("nodos") or [] if node.get("id") == node_id), None)


def node_type(node: dict[str, Any] | None) -> str:
    return str((node or {}).get("tipo") or "").upper()


def is_activity(node: dict[str, Any] | None) -> bool:
    return node_type(node) in {"ACTIVITY", "ACTIVIDAD"}


def get_departments(politica: dict[str, Any]) -> list[dict[str, Any]]:
    return list(politica.get("departamentos") or [])


def get_assignees_for_node(node: dict[str, Any] | None, politica: dict[str, Any]) -> list[str]:
    if not node:
        return []
    assigned = node.get("funcionariosAsignados") or []
    if assigned:
        return list(assigned)

    department_id = node.get("departamentoId")
    department = next((dept for dept in get_departments(politica) if dept.get("id") == department_id), None)
    return list((department or {}).get("funcionariosAsignados") or [])


def next_route_options(politica: dict[str, Any], current_node: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not current_node:
        return []

    current_id = current_node.get("id")
    connections = list(politica.get("conexiones") or [])
    direct = [conn for conn in connections if conn.get("origenId") == current_id]
    options: list[dict[str, Any]] = []

    for conn in direct:
        target = find_node(politica, conn.get("destinoId"))
        if node_type(target) == "DECISION":
            decision_connections = [
                item for item in connections
                if item.get("origenId") == target.get("id") and str(item.get("condicion") or "").upper() != "DEFAULT"
            ]
            for decision_conn in decision_connections:
                decision_target = find_node(politica, decision_conn.get("destinoId"))
                options.append(route_option(decision_conn, decision_target, politica))
        else:
            options.append(route_option(conn, target, politica))

    return options


def route_option(conn: dict[str, Any], target: dict[str, Any] | None, politica: dict[str, Any]) -> dict[str, Any]:
    assignees = get_assignees_for_node(target, politica)
    return {
        "condition": conn.get("condicion") or "DEFAULT",
        "targetNodeId": (target or {}).get("id"),
        "targetNodeName": (target or {}).get("nombre") or "Fin del tramite",
        "targetType": node_type(target) or "END",
        "assignees": assignees,
    }


def choose_best_route(
    options: list[dict[str, Any]],
    workload: dict[str, int],
    politica: dict[str, Any],
) -> dict[str, Any] | None:
    if not options:
        return None

    def option_score(option: dict[str, Any]) -> float:
        condition = str(option.get("condition") or "").lower()
        assignees = list(option.get("assignees") or [])
        load = min([workload.get(user, 0) for user in assignees] or [0])
        penalty = 0
        if any(word in condition for word in ["rechazo", "observacion", "correccion", "devolver"]):
            penalty += 3
        if option.get("targetType") in {"END", "FIN"}:
            penalty += 1
        return load + penalty

    best = min(options, key=option_score)
    reason = "Ruta con menor carga operativa"
    if best.get("assignees"):
        reason += f": {', '.join(best['assignees'])}"
    return {**best, "reason": reason}


def build_features(
    tramite: dict[str, Any],
    politica: dict[str, Any],
    current_node: dict[str, Any] | None,
    historial: list[dict[str, Any]],
    current_assignees: list[str],
    workload: dict[str, int],
) -> dict[str, Any]:
    start = parse_dt(tramite.get("fechaInicio"))
    last_completed = parse_dt(historial[-1].get("fechaCompletado")) if historial else start
    activity_nodes = [node for node in politica.get("nodos") or [] if is_activity(node)]
    completed_nodes = {log.get("nodoId") for log in historial}
    pending_steps = len([node for node in activity_nodes if node.get("id") not in completed_nodes])
    required_files = [
        field for field in (current_node or {}).get("campos") or []
        if str(field.get("tipo") or "").upper() in {"FOTO", "ARCHIVO"}
    ]
    rework_count = sum(
        1 for log in historial
        if any(word in str(log.get("informeIA") or log.get("nombreNodo") or "").lower()
               for word in ["rechazo", "observacion", "correccion", "devuelto"])
    )
    durations = [
        float(log.get("duracionSegundos") or 0)
        for log in historial
        if float(log.get("duracionSegundos") or 0) > 0
    ]
    max_workload = max([workload.get(user, 0) for user in current_assignees] or [0])

    return {
        "ageDays": round(elapsed_days(start), 2),
        "currentStageDays": round(elapsed_days(last_completed), 2),
        "totalActivitySteps": len(activity_nodes),
        "completedSteps": len(completed_nodes),
        "pendingSteps": pending_steps,
        "completionRatio": round(len(completed_nodes) / max(len(activity_nodes), 1), 3),
        "requiredFileFields": len(required_files),
        "currentAssigneeCount": len(current_assignees),
        "maxCurrentAssigneeWorkload": max_workload,
        "reworkCount": rework_count,
        "avgStageHours": round((sum(durations) / len(durations) / 3600.0), 2) if durations else 0,
        "isFinished": str(tramite.get("estado") or "").upper() == "FINALIZADO",
    }


def risk_score(features: dict[str, Any]) -> int:
    if features.get("isFinished"):
        return 5

    model_score = predict_risk_score_with_model(features)
    if model_score is not None:
        return model_score

    values = [
        min(float(features.get("currentStageDays") or 0) / 5.0, 1.0),
        min(float(features.get("ageDays") or 0) / 15.0, 1.0),
        min(float(features.get("pendingSteps") or 0) / 8.0, 1.0),
        min(float(features.get("requiredFileFields") or 0) / 3.0, 1.0),
        min(float(features.get("maxCurrentAssigneeWorkload") or 0) / 5.0, 1.0),
        1.0 if int(features.get("currentAssigneeCount") or 0) == 0 else 0.0,
        min(float(features.get("reworkCount") or 0) / 3.0, 1.0),
        min(float(features.get("avgStageHours") or 0) / 24.0, 1.0),
    ]
    weights = [0.26, 0.14, 0.10, 0.09, 0.14, 0.16, 0.07, 0.04]

    if tf:
        tensor_values = tf.constant(values, dtype=tf.float32)
        tensor_weights = tf.constant(weights, dtype=tf.float32)
        bias = tf.constant(-1.05, dtype=tf.float32)
        probability = tf.sigmoid(tf.reduce_sum(tensor_values * tensor_weights) * 3.0 + bias)
        return int(round(float(probability.numpy()) * 100))

    weighted = sum(value * weight for value, weight in zip(values, weights))
    return int(round(min(max(weighted * 100, 0), 100)))


def predict_risk_score_with_model(features: dict[str, Any]) -> int | None:
    model, metadata = load_trained_model()
    if model is None or not metadata:
        return None

    feature_names = list(metadata.get("featureNames") or [])
    means = list(metadata.get("means") or [])
    stds = list(metadata.get("stds") or [])
    if not feature_names or len(feature_names) != len(means) or len(feature_names) != len(stds):
        return None

    values = []
    for index, name in enumerate(feature_names):
        raw = features.get(name, 0)
        numeric = 1.0 if isinstance(raw, bool) and raw else 0.0 if isinstance(raw, bool) else float(raw or 0)
        std = float(stds[index] or 1.0)
        values.append((numeric - float(means[index])) / std)

    prediction = model.predict(tf.constant([values], dtype=tf.float32), verbose=0)
    score = float(prediction[0][0])
    if score <= 1:
        score *= 100
    return int(round(min(max(score, 0), 100)))


def risk_label(score: int) -> str:
    if score >= 70:
        return "ALTO"
    if score >= 40:
        return "MEDIO"
    return "BAJO"


def estimate_days(features: dict[str, Any], score: int) -> int:
    if features.get("isFinished"):
        return 0
    base = max(int(features.get("pendingSteps") or 1), 1)
    workload_extra = min(int(features.get("maxCurrentAssigneeWorkload") or 0), 4) * 0.5
    risk_multiplier = 1 + (score / 100.0)
    return max(1, int(round((base + workload_extra) * risk_multiplier)))


def build_motives(features: dict[str, Any], risk_level: str) -> list[str]:
    if features.get("isFinished"):
        return ["El tramite ya esta finalizado."]

    motives: list[str] = []
    if float(features.get("currentStageDays") or 0) >= 2:
        motives.append("La etapa actual lleva mas de 2 dias abierta.")
    if int(features.get("requiredFileFields") or 0) > 0:
        motives.append("La etapa actual requiere documentos o imagenes obligatorias.")
    if int(features.get("maxCurrentAssigneeWorkload") or 0) >= 3:
        motives.append("El funcionario actual tiene una carga alta de tramites activos.")
    if int(features.get("currentAssigneeCount") or 0) == 0:
        motives.append("La etapa no tiene funcionarios asignados.")
    if int(features.get("reworkCount") or 0) > 0:
        motives.append("El historial muestra observaciones, correcciones o rechazos previos.")
    if not motives:
        motives.append(f"El riesgo estimado es {risk_level.lower()} segun avance, carga y tiempo.")
    return motives


def build_improvements(features: dict[str, Any], best_route: dict[str, Any] | None) -> list[str]:
    improvements: list[str] = []
    if int(features.get("currentAssigneeCount") or 0) == 0:
        improvements.append("Asignar un funcionario responsable antes de avanzar la etapa.")
    if int(features.get("requiredFileFields") or 0) > 0:
        improvements.append("Validar documentos al inicio de la atencion para evitar devoluciones.")
    if int(features.get("maxCurrentAssigneeWorkload") or 0) >= 3:
        improvements.append("Redistribuir la tarea hacia el funcionario con menor carga disponible.")
    if best_route:
        improvements.append(f"Ruta sugerida: {best_route.get('targetNodeName')} ({best_route.get('reason')}).")
    if not improvements:
        improvements.append("Mantener la ruta actual y monitorear el tiempo de etapa.")
    return improvements
