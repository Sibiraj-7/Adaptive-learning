from flask import Flask
from routes.auth_routes import auth_bp

def register_blueprints(app: Flask) -> None:
    app.register_blueprints(auth_bp, url_prefix="/api/auth")