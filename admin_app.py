import os
from flask import Flask, send_from_directory, jsonify

app = Flask(__name__, static_folder='frontend', static_url_path='')

@app.route('/')
def admin_dashboard():
    # Serve index.html from the frontend/admin directory
    return send_from_directory(os.path.join('frontend', 'admin'), 'index.html')

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "service": "Flask Admin Panel"})

if __name__ == '__main__':
    # Run Flask server on port 5000
    print("Starting Flask Admin Panel on http://localhost:5000")
    app.run(port=5000, debug=True)
