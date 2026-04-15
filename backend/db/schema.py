from typing import Any, TypedDict

# --- Collection names ---

COLLECTION_USERS = "users"
COLLECTION_QUESTIONS = "questions"
COLLECTION_QUIZZES = "quizzes"
COLLECTION_QUIZ_ASSIGNMENTS = "quiz_assignments"
COLLECTION_QUIZ_ATTEMPTS = "quiz_attempts"
COLLECTION_STUDENT_MASTERY = "student_mastery"
COLLECTION_LEARNING_MATERIALS = "learning_materials"



class UserDoc(TypedDict, total=False):
    _id: Any
    email: str
    password_hash: str
    role: str  # "teacher" | "student"
    full_name: str
    department: str 


class QuestionOption(TypedDict):
    key: str
    text: str


class QuestionDoc(TypedDict, total=False):
    _id: Any
    teacher_id: Any
    subject: str
    topic: str
    question_text: str
    difficulty: str  # "easy" | "medium" | "hard"
    options: list[QuestionOption]
    correct_answer: str
    created_at: Any


class QuizDoc(TypedDict, total=False):
    _id: Any
    title: str
    teacher_id: Any
    subject: str
    topic: str
    difficulty: str  # "easy" | "medium" | "hard"
    question_ids: list[Any]
    created_at: Any


class QuizAssignmentDoc(TypedDict, total=False):
    _id: Any
    quiz_id: Any
    teacher_id: Any
    target_type: str
    department: str
    student_ids: list[Any]
    due_at: Any  
    created_at: Any


class AnswerEntry(TypedDict, total=False):
    question_id: Any
    selected_option: str


class QuizAttemptDoc(TypedDict, total=False):
    _id: Any
    quiz_id: Any
    student_id: Any
    assignment_id: Any
    answers: list[AnswerEntry]
    submitted_at: Any
    total_score: float
    max_score: float
    topic_performance: dict[str, dict[str, float]]  
    recommended_next_topic: str  


class StudentMasteryDoc(TypedDict, total=False):
    _id: Any
    student_id: Any
    subject: str  
    topic_mastery: dict[str, float] 
    updated_at: Any
    last_attempt_id: Any


class LearningMaterialDoc(TypedDict, total=False):
    _id: Any
    subject: str
    topic: str
    title: str
    resource_type: str  
    type: str 
    url: str
    file_path: str  
    difficulty: str
    department: str
    uploaded_by: str
    created_at: Any
