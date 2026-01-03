#!/usr/bin/env python3
"""
Servidor HTTP simple con configuración CORS para Calendar10
Permite acceso desde navegadores externos (Safari, Chrome, etc.)
"""

import http.server
import socketserver
import os
from urllib.parse import urlparse

PORT = 8079

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Permitir acceso desde cualquier origen
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Headers de seguridad para PWA
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        
        # Cache control
        if self.path.endswith('.js') or self.path.endswith('.css'):
            self.send_header('Cache-Control', 'no-cache')
        
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def guess_type(self, path):
        """Mejorar detección de tipos MIME"""
        base, ext = os.path.splitext(path)
        if ext.lower() == '.js':
            return 'application/javascript; charset=utf-8'
        elif ext.lower() == '.css':
            return 'text/css; charset=utf-8'
        elif ext.lower() == '.json':
            return 'application/json; charset=utf-8'
        elif ext.lower() == '.webmanifest':
            return 'application/manifest+json; charset=utf-8'
        elif ext.lower() == '.html':
            return 'text/html; charset=utf-8'
        return super().guess_type(path)
    
    def do_GET(self):
        """Override GET to add proper headers"""
        # Call parent first
        super().do_GET()
        
    def send_response(self, code, message=None):
        """Override to add security headers"""
        super().send_response(code, message)
        
        # Security headers for better browser compatibility
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')

def main():
    os.chdir('/Users/alejandrorollano/Calendario')
    
    with socketserver.TCPServer(("0.0.0.0", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"🚀 Calendar10 server running at:")
        print(f"   • Local:    http://localhost:{PORT}")
        print(f"   • Network:  http://0.0.0.0:{PORT}")
        print(f"   • Directory: {os.getcwd()}")
        print("✅ CORS enabled for external browsers")
        print("🔄 Press Ctrl+C to stop")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    main()