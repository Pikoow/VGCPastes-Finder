from flask import Flask, request, jsonify, render_template
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.generate import generate_pokepaste

app = Flask(__name__, template_folder="../templates", static_folder="../static")

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    instruction = data.get("instruction")
    if not instruction:
        return jsonify({"error": "No instruction provided"}), 400
    
    pokepaste = generate_pokepaste(instruction)
    return jsonify(pokepaste)

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run()