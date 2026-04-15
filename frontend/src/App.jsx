import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import TeacherLayout from './pages/TeacherLayout'
import StudentLayout from './pages/StudentLayout'
import TeacherDashboard from './pages/TeacherDashboard'
import Quizzes from './pages/Quizzes'
import TeacherStudentAttempts from './pages/TeacherStudentAttempts'
import StudentDashboard from './pages/StudentDashboard'
import QuizAttempt from './pages/QuizAttempt'
import StudentQuizzes from './pages/StudentQuizzes'
import StudentProgress from './pages/StudentProgress'
import Materials from './pages/Materials'
import StudentMaterials from './pages/StudentMaterials'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="quizzes" element={<Quizzes />} />
            <Route
              path="quizzes/:quizId/student/:studentId"
              element={<TeacherStudentAttempts />}
            />
            <Route path="materials" element={<Materials />} />
          </Route>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="quizzes" element={<StudentQuizzes />} />
            <Route path="progress" element={<StudentProgress />} />
            <Route path="materials" element={<StudentMaterials />} />
            <Route path="quiz/:quizId" element={<QuizAttempt />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
