from __future__ import annotations

import argparse
import json
import random
from pathlib import Path


def clamp(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return int(max(min(round(value), maximum), minimum))


def risk_level(score: int) -> str:
    if score >= 70:
        return "ALTO"
    if score >= 40:
        return "MEDIO"
    return "BAJO"


def build_case(index: int, rng: random.Random) -> dict:
    total_steps = rng.randint(2, 8)
    completed_steps = rng.randint(0, total_steps)
    pending_steps = total_steps - completed_steps
    is_finished = completed_steps == total_steps and rng.random() < 0.45
    current_assignee_count = rng.choice([0, 1, 1, 1, 2, 3])
    required_files = rng.choice([0, 0, 1, 1, 2, 3])
    rework_count = rng.choice([0, 0, 0, 1, 1, 2, 3])
    workload = rng.randint(0, 7)
    current_stage_days = round(rng.uniform(0, 8), 2)
    age_days = round(max(current_stage_days, rng.uniform(current_stage_days, 28)), 2)
    avg_stage_hours = round(rng.uniform(0, 48), 2) if completed_steps else 0

    if is_finished:
        pending_steps = 0
        current_stage_days = 0
        score = rng.randint(2, 12)
    else:
        score = (
            current_stage_days * 9.0
            + age_days * 1.4
            + pending_steps * 5.5
            + required_files * 7.5
            + workload * 5.0
            + rework_count * 9.0
            + (18 if current_assignee_count == 0 else 0)
            + avg_stage_hours * 0.35
            + rng.uniform(-7, 7)
        )

    risk_score = clamp(score)

    return {
        "id": f"demo-{index:04d}",
        "features": {
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
        },
        "label": {
            "riskScore": risk_score,
            "riskLevel": risk_level(risk_score),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="ai-service/data/demo_risk_cases.jsonl")
    parser.add_argument("--rows", type=int, default=800)
    parser.add_argument("--seed", type=int, default=20260531)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    with output.open("w", encoding="utf-8") as file:
        for index in range(args.rows):
            file.write(json.dumps(build_case(index + 1, rng), ensure_ascii=True) + "\n")

    print(f"Generated {args.rows} training cases at {output}")


if __name__ == "__main__":
    main()
