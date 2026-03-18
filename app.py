import os
from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename
from services.local_model_service import analyze_chest_xray

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_UPLOAD_MB = 10

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/analyze")
def analyze():
    if "xray" not in request.files:
        return jsonify({"error": "No image uploaded. Please choose a lung X-ray image."}), 400

    uploaded_file = request.files["xray"]

    if uploaded_file.filename == "":
        return jsonify({"error": "Empty file name. Please choose a valid image."}), 400

    if not allowed_file(uploaded_file.filename):
        return jsonify({"error": "Unsupported format. Use PNG, JPG, JPEG, or WEBP."}), 400

    filename = secure_filename(uploaded_file.filename)
    assistive_mode = request.form.get("assistive_mode", "balanced")
    patient_context = {
        "sex": request.form.get("sex", ""),
        "age": request.form.get("age", ""),
        "smoking_history": request.form.get("smoking_history", ""),
        "spo2": request.form.get("spo2", ""),
        "scan_date": request.form.get("scan_date", ""),
    }

    # Save uploaded image to a temporary file
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
        tmp.write(uploaded_file.read())
        tmp_path = tmp.name

    import time
    try:
        # Simulate model analysis delay
        time.sleep(2.5)
        result = analyze_chest_xray(
            image_path=tmp_path,
            # Optionally pass assistive_mode and patient_context if your dummy function supports them
        )
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Analysis failed: {str(exc)}"}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    app.run(debug=True)
