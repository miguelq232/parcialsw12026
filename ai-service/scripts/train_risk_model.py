from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import mean, pstdev


FEATURE_NAMES = [
    "ageDays",
    "currentStageDays",
    "totalActivitySteps",
    "completedSteps",
    "pendingSteps",
    "completionRatio",
    "requiredFileFields",
    "currentAssigneeCount",
    "maxCurrentAssigneeWorkload",
    "reworkCount",
    "avgStageHours",
    "isFinished",
]


def load_cases(path: Path) -> list[dict]:
    cases: list[dict] = []
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            if line.strip():
                cases.append(json.loads(line))
    return cases


def feature_value(features: dict, name: str) -> float:
    value = features.get(name, 0)
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    return float(value or 0)


def normalize_matrix(rows: list[list[float]], means: list[float], stds: list[float]) -> list[list[float]]:
    return [
        [(value - means[index]) / stds[index] for index, value in enumerate(row)]
        for row in rows
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="ai-service/data/demo_risk_cases.jsonl")
    parser.add_argument("--model-dir", default="ai-service/models")
    parser.add_argument("--epochs", type=int, default=180)
    args = parser.parse_args()

    try:
        import numpy as np  # type: ignore
        import tensorflow as tf  # type: ignore
    except Exception as exc:
        raise SystemExit(
            "TensorFlow no esta instalado en este Python. "
            "Instala con: python -m pip install -r ai-service/requirements-tensorflow.txt"
        ) from exc

    data_path = Path(args.data)
    cases = load_cases(data_path)
    if len(cases) < 50:
        raise SystemExit("Necesitas al menos 50 casos para entrenar.")

    x_raw = [
        [feature_value(case.get("features", {}), name) for name in FEATURE_NAMES]
        for case in cases
    ]
    y = [
        float(case.get("label", {}).get("riskScore", 0)) / 100.0
        for case in cases
    ]

    columns = list(zip(*x_raw))
    means = [mean(column) for column in columns]
    stds = [pstdev(column) or 1.0 for column in columns]
    x = normalize_matrix(x_raw, means, stds)

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(len(FEATURE_NAMES),)),
        tf.keras.layers.Dense(24, activation="relu"),
        tf.keras.layers.Dense(12, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.01),
        loss="mse",
        metrics=[tf.keras.metrics.MeanAbsoluteError(name="mae")],
    )

    x_train = np.array(x, dtype="float32")
    y_train = np.array(y, dtype="float32")

    history = model.fit(
        x_train,
        y_train,
        epochs=args.epochs,
        batch_size=32,
        validation_split=0.2,
        verbose=0,
    )

    model_dir = Path(args.model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "risk_model.keras"
    metadata_path = model_dir / "risk_model_metadata.json"

    model.save(model_path)
    metadata = {
        "featureNames": FEATURE_NAMES,
        "means": means,
        "stds": stds,
        "rows": len(cases),
        "epochs": args.epochs,
        "finalLoss": float(history.history["loss"][-1]),
        "finalValLoss": float(history.history["val_loss"][-1]),
        "finalMae": float(history.history["mae"][-1]),
        "finalValMae": float(history.history["val_mae"][-1]),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"Saved model: {model_path}")
    print(f"Saved metadata: {metadata_path}")
    print(
        "MAE aproximado:",
        round(metadata["finalValMae"] * 100, 2),
        "puntos de riesgo",
    )


if __name__ == "__main__":
    main()
