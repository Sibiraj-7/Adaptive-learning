from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from db.connection import init_db
from routes import register_blueprints
from services.errors import ServiceError


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    init_db()
    register_blueprints(app)

    @app.errorhandler(ServiceError)
    def handle_service_error(exc: ServiceError):
        return jsonify({"error": exc.message}), exc.status

    @app.get("/")
    def home():
        return {"status": "ok", "message": "Backend running successfully"}

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
