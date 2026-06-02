import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from reviewer import review_code
from github_handler import verify_signature, handle_pr_event

app = Flask(__name__)
CORS(app)

@app.route("/health")
def health():
    return jsonify({"status": "ok", "model": "gemini-1.5-flash"})

@app.route("/review", methods=["POST"])
def review():
    data = request.get_json()
    code = data.get("code", "").strip()
    language = data.get("language", "auto")
    context = data.get("context", "")

    if not code:
        return jsonify({"error": "No code provided"}), 400
    if len(code) > 50000:
        return jsonify({"error": "Code too long (max 50,000 chars)"}), 400

    result = review_code(code, language, context)
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)

@app.route("/webhook/github", methods=["POST"])
def github_webhook():
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, signature):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    if event == "ping":
        return jsonify({"message": "Webhook connected!"})
    if event != "pull_request":
        return jsonify({"skipped": True, "event": event})

    result = handle_pr_event(request.get_json())
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True, port=5000)