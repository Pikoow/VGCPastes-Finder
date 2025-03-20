from http.server import BaseHTTPRequestHandler
import json
from models.generate import generate_pokepaste

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)
        
        instruction = data.get("instruction")
        if not instruction:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = json.dumps({"error": "No instruction provided"})
            self.wfile.write(response.encode())
            return
        
        pokepaste = generate_pokepaste(instruction)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response = json.dumps(pokepaste)
        self.wfile.write(response.encode())