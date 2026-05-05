from pathlib import Path

path = Path(r".\deep_ml\scripts\06_train_alpha_structural.py")

text = path.read_text(encoding="utf-8")

old = '"rmse": float(mean_squared_error(y_true, y_pred, squared=False)),'
new = '"rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),'

if old not in text:
    raise SystemExit("Target RMSE line not found. Maybe it was already patched.")

text = text.replace(old, new)

path.write_text(text, encoding="utf-8")

print("Patched Phase 6 RMSE calculation successfully.")