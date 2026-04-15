from flask import Flask

from routes.attempt_routes import attempts_bp
from routes.auth_routes import auth_bp
from routes.dashboard_routes import dashboard_bp
from routes.health import health_bp
from routes.material_routes import materials_bp
from routes.question_routes import questions_bp
from routes.quiz_routes import quizzes_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(questions_bp, url_prefix="/api/questions")
    app.register_blueprint(quizzes_bp, url_prefix="/api/quizzes")
    app.register_blueprint(attempts_bp, url_prefix="/api/attempts")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(materials_bp, url_prefix="/api/materials")
