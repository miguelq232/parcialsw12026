from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

RISK_PROFILES = ("BAJO", "MEDIO", "ALTO")
SCENARIOS = (
    "tramite_simple",
    "tramite_normal",
    "sin_asignado",
    "alta_carga",
    "documentos_pendientes",
    "retrabajo",
    "estancado",
    "finalizado",
)


def clamp(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return int(max(min(round(value), maximum), minimum))


def risk_level(score: int) -> str:
    if score >= 70:
        return "ALTO"
    if score >= 40:
        return "MEDIO"
    return "BAJO"


def score_from_features(features: dict, rng: random.Random) -> int:
    if features.get("isFinished"):
        return rng.randint(2, 12)

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
    score = sum(value * weight for value, weight in zip(values, weights)) * 100
    return clamp(score + rng.uniform(-5, 5))


def weighted_choice(rng: random.Random, values: list[tuple[int, float]]) -> int:
    total = sum(weight for _, weight in values)
    marker = rng.uniform(0, total)
    cursor = 0.0
    for value, weight in values:
        cursor += weight
        if marker <= cursor:
            return value
    return values[-1][0]


def pick_scenario(index: int, rng: random.Random, balanced: bool) -> tuple[str, str]:
    if balanced:
        return RISK_PROFILES[index % len(RISK_PROFILES)], SCENARIOS[index % len(SCENARIOS)]

    risk_profile = rng.choices(RISK_PROFILES, weights=[0.34, 0.33, 0.33], k=1)[0]
    scenario = rng.choices(
        SCENARIOS,
        weights=[0.12, 0.24, 0.10, 0.14, 0.13, 0.10, 0.11, 0.06],
        k=1,
    )[0]
    return risk_profile, scenario


def build_case(index: int, rng: random.Random, risk_profile: str, scenario: str) -> dict:
    total_steps = rng.randint(2, 10)

    if risk_profile == "BAJO":
        completed_steps = rng.randint(max(total_steps - 2, 0), total_steps)
    elif risk_profile == "MEDIO":
        completed_steps = rng.randint(max(total_steps // 3, 0), max(total_steps - 1, 1))
    else:
        completed_steps = rng.randint(0, max(total_steps - 2, 0))

    pending_steps = total_steps - completed_steps
    is_finished = scenario == "finalizado" or (completed_steps == total_steps and rng.random() < 0.65)

    current_assignee_count = weighted_choice(rng, [(0, 0.08), (1, 0.52), (2, 0.28), (3, 0.12)])
    required_files = weighted_choice(rng, [(0, 0.34), (1, 0.30), (2, 0.20), (3, 0.11), (4, 0.05)])
    rework_count = weighted_choice(rng, [(0, 0.52), (1, 0.26), (2, 0.13), (3, 0.07), (4, 0.02)])
    workload = rng.randint(0, 10)

    if risk_profile == "BAJO":
        current_stage_days = round(rng.uniform(0, 2.5), 2)
        age_days = round(rng.uniform(current_stage_days, 8), 2)
        avg_stage_hours = round(rng.uniform(0, 18), 2) if completed_steps else 0
    elif risk_profile == "MEDIO":
        current_stage_days = round(rng.uniform(1.5, 6.5), 2)
        age_days = round(rng.uniform(current_stage_days, 20), 2)
        avg_stage_hours = round(rng.uniform(8, 42), 2) if completed_steps else 0
    else:
        current_stage_days = round(rng.uniform(4.5, 15), 2)
        age_days = round(rng.uniform(current_stage_days, 45), 2)
        avg_stage_hours = round(rng.uniform(24, 96), 2) if completed_steps else 0

    if scenario == "sin_asignado":
        current_assignee_count = 0
    elif scenario == "alta_carga":
        workload = rng.randint(7, 14)
    elif scenario == "documentos_pendientes":
        required_files = rng.randint(2, 5)
    elif scenario == "retrabajo":
        rework_count = rng.randint(2, 5)
    elif scenario == "estancado":
        current_stage_days = round(rng.uniform(8, 22), 2)
        age_days = round(rng.uniform(current_stage_days, 55), 2)
    elif scenario == "tramite_simple":
        total_steps = rng.randint(2, 4)
        completed_steps = min(completed_steps, total_steps)
        pending_steps = total_steps - completed_steps
        required_files = min(required_files, 1)
        rework_count = min(rework_count, 1)

    if is_finished:
        pending_steps = 0
        current_stage_days = 0
        completed_steps = total_steps
    features = {
        "ageDays": age_days,
        "currentStageDays": current_stage_days,
        "totalActivitySteps": total_steps,
        "completedSteps": completed_steps,
        "pendingSteps": pending_steps,
        "completionRatio": round(completed_steps / max(total_steps, 1), 3),
        "requiredFileFields": required_files,
        "currentAssigneeCount": current_assignee_count,
        "maxCurrentAssigneeWorkload": workload,
        "reworkCount": rework_count,
        "avgStageHours": avg_stage_hours,
        "isFinished": is_finished,
    }
    risk_score = score_from_features(features, rng)

    return {
        "id": f"demo-{index:04d}",
        "scenario": scenario,
        "features": features,
        "label": {
            "riskScore": risk_score,
            "riskLevel": risk_level(risk_score),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="ai-service/data/demo_risk_cases.jsonl")
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=20260531)
    parser.add_argument("--unbalanced", action="store_true")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    counts = {"BAJO": 0, "MEDIO": 0, "ALTO": 0}
    with output.open("w", encoding="utf-8") as file:
        for index in range(args.rows):
            risk_profile, scenario = pick_scenario(index, rng, balanced=not args.unbalanced)
            case = build_case(index + 1, rng, risk_profile, scenario)
            if not args.unbalanced:
                for _ in range(80):
                    if case["label"]["riskLevel"] == risk_profile:
                        break
                    scenario = rng.choice(SCENARIOS)
                    case = build_case(index + 1, rng, risk_profile, scenario)
            counts[case["label"]["riskLevel"]] += 1
            file.write(json.dumps(case, ensure_ascii=True) + "\n")

    print(f"Generated {args.rows} training cases at {output}")
    print("Risk distribution:", counts)


if __name__ == "__main__":
    main()
