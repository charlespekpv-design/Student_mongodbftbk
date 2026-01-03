/* eslint-disable no-restricted-globals */
import React, { useState, useEffect } from 'react';
import './styles.css';
import { LogOut, User, Book, Clock, CheckCircle, Plus, X } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export default function EnhancedStudentPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [alert, setAlert] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [allCourses, setAllCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    courseCode: '', title: '', description: '', level: 'Beginner', credits: '', instructor: '', schedule: ''
  });
  const [sessionDuration, setSessionDuration] = useState(30 * 60);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleAutoLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemaining < 60) return 'text-red-600';
    if (timeRemaining < 300) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleAutoLogout = async () => {
    showAlert('Session expired. Please login again.', 'error');
    setTimerActive(false);
    await handleLogout();
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsAuthenticated(true);
        setCurrentView('dashboard');
        setTimerActive(true);
        fetchAllCourses();
        fetchMyCourses();
      }
    } catch (err) {
      console.log('Not authenticated');
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Registration successful! Please login.');
        setIsRegister(false);
        setRegisterForm({ name: '', email: '', password: '' });
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setIsAuthenticated(true);
        setCurrentView('dashboard');
        const durationInSeconds = data.sessionDuration / 1000;
        setSessionDuration(durationInSeconds);
        setTimeRemaining(durationInSeconds);
        setTimerActive(true);
        showAlert('Welcome back, ' + data.user.name + '!');
        setLoginForm({ email: '', password: '' });
        fetchAllCourses();
        fetchMyCourses();
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsAuthenticated(false);
    setUser(null);
    setCurrentView('login');
    setTimerActive(false);
    setTimeRemaining(sessionDuration);
    setAllCourses([]);
    setMyCourses([]);
  };

  const fetchAllCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/courses`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllCourses(data.courses);
      }
    } catch (err) {
      showAlert('Failed to load courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyCourses = async () => {
    try {
      const res = await fetch(`${API_URL}/courses/my`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyCourses(data.courses);
      }
    } catch (err) {
      showAlert('Failed to load your courses', 'error');
    }
  };

  const handleCreateCourse = async () => {
    try {
      if (!courseForm.courseCode || !courseForm.title || !courseForm.credits) {
        showAlert('Please fill in all required fields', 'error');
        return;
      }
      setLoading(true);
      const res = await fetch(`${API_URL}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...courseForm, credits: parseInt(courseForm.credits) })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Course created successfully!');
        setShowCourseModal(false);
        setCourseForm({ courseCode: '', title: '', description: '', level: 'Beginner', credits: '', instructor: '', schedule: '' });
        fetchAllCourses();
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Failed to create course', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/courses/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Successfully enrolled!');
        fetchMyCourses();
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Enrollment failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (courseId) => {
    if (!window.confirm('Are you sure you want to unenroll?')) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/courses/unenroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Successfully unenrolled');
        fetchMyCourses();
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Unenrollment failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isEnrolled = (courseId) => {
    return myCourses.some(course => course._id === courseId);
  };

  // SEE PART 2 FOR RENDER CODE
  // REPLACE "return null;" in Part 1 with this entire render code:

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Book size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {isRegister ? 'Create Account' : 'Student Portal'}
            </h1>
            <p className="text-gray-600 mt-2">{isRegister ? 'Join our learning community' : 'Sign in to continue'}</p>
          </div>
          
          {alert && (
            <div className={`mb-4 p-4 rounded-lg ${alert.type === 'error' ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : 'bg-green-50 text-green-700 border-l-4 border-green-500'}`}>
              {alert.message}
            </div>
          )}

          {isRegister ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input type="text" placeholder="John Doe" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition" value={registerForm.name} onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input type="email" placeholder="you@example.com" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition" value={registerForm.email} onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input type="password" placeholder="Min 8 characters" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition" value={registerForm.password} onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})} />
              </div>
              <button onClick={handleRegister} disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 transition transform hover:scale-105">
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <button onClick={() => setIsRegister(false)} className="w-full text-indigo-600 hover:text-indigo-700 font-medium">
                Already have an account? <span className="underline">Sign In</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input type="email" placeholder="you@example.com" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition" value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input type="password" placeholder="Enter password" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 transition transform hover:scale-105">
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              <button onClick={() => setIsRegister(true)} className="w-full text-indigo-600 hover:text-indigo-700 font-medium">
                Don't have an account? <span className="underline">Create One</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-2xl ${alert.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white max-w-md`}>
          {alert.message}
        </div>
      )}

      {showCourseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Create New Course</h3>
              <button onClick={() => setShowCourseModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course Code *</label>
                  <input type="text" placeholder="e.g., CS101" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.courseCode} onChange={(e) => setCourseForm({...courseForm, courseCode: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Credits *</label>
                  <input type="number" placeholder="3" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.credits} onChange={(e) => setCourseForm({...courseForm, credits: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Course Title *</label>
                <input type="text" placeholder="Introduction to Programming" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.title} onChange={(e) => setCourseForm({...courseForm, title: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea rows="3" placeholder="Course description..." className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.description} onChange={(e) => setCourseForm({...courseForm, description: e.target.value})} />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Level</label>
                  <select className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.level} onChange={(e) => setCourseForm({...courseForm, level: e.target.value})}>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Instructor</label>
                  <input type="text" placeholder="Dr. Smith" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.instructor} onChange={(e) => setCourseForm({...courseForm, instructor: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Schedule</label>
                <input type="text" placeholder="Mon/Wed 9:00-10:30 AM" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500" value={courseForm.schedule} onChange={(e) => setCourseForm({...courseForm, schedule: e.target.value})} />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button onClick={handleCreateCourse} disabled={loading} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Course'}
                </button>
                <button onClick={() => setShowCourseModal(false)} className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Book size={32} />
              <h1 className="text-2xl font-bold">Student Portal</h1>
            </div>
            
            <div className={`flex items-center gap-2 ${getTimerColor()} bg-white px-4 py-2 rounded-lg shadow-md`}>
              <Clock size={20} />
              <span className="font-bold text-lg">{formatTime(timeRemaining)}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-2 rounded-lg ${currentView === 'dashboard' ? 'bg-white bg-opacity-20' : 'hover:bg-white hover:bg-opacity-10'}`}>
                Dashboard
              </button>
              <button onClick={() => setCurrentView('my-courses')} className={`px-4 py-2 rounded-lg ${currentView === 'my-courses' ? 'bg-white bg-opacity-20' : 'hover:bg-white hover:bg-opacity-10'}`}>
                My Courses
              </button>
              <button onClick={() => setCurrentView('profile')} className={`px-4 py-2 rounded-lg flex items-center gap-2 ${currentView === 'profile' ? 'bg-white bg-opacity-20' : 'hover:bg-white hover:bg-opacity-10'}`}>
                <User size={18} /> Profile
              </button>
              <button onClick={handleLogout} className="px-4 py-2 rounded-lg hover:bg-red-500 flex items-center gap-2">
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-6">
        {currentView === 'dashboard' && (
          <div>
            <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
              <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Welcome back, {user?.name}! 👋
              </h2>
              <p className="text-gray-600">Student ID: <span className="font-semibold text-indigo-600">{user?.studentId}</span> • {user?.email}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Session Time</p>
                    <p className={`text-2xl font-bold ${getTimerColor()}`}>{formatTime(timeRemaining)}</p>
                  </div>
                  <Clock size={40} className="text-indigo-200" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Enrolled Courses</p>
                    <p className="text-2xl font-bold">{myCourses.length}</p>
                  </div>
                  <CheckCircle size={40} className="text-green-200" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Credits</p>
                    <p className="text-2xl font-bold">{myCourses.reduce((sum, c) => sum + (c.credits || 0), 0)}</p>
                  </div>
                  <Book size={40} className="text-purple-200" />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-bold">Available Courses</h3>
              <button onClick={() => setShowCourseModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg flex items-center gap-2 transform hover:scale-105 transition">
                <Plus size={20} /> Create Course
              </button>
            </div>
            
            {loading && <p className="text-center py-8">Loading...</p>}
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {allCourses.map((course) => (
                <div key={course._id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-100 transform hover:-translate-y-1">
                  <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-2">
                          {course.courseCode}
                        </span>
                        <h4 className="text-xl font-bold">{course.title}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        course.level === 'Beginner' ? 'bg-green-100 text-green-700' :
                        course.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {course.level}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                    <div className="space-y-2 mb-4 text-sm text-gray-600">
                      <p><strong>Credits:</strong> {course.credits}</p>
                      <p><strong>Instructor:</strong> {course.instructor}</p>
                      <p><strong>Schedule:</strong> {course.schedule}</p>
                    </div>
                    {isEnrolled(course._id) ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 py-3 rounded-lg font-semibold">
                        <CheckCircle size={20} />Enrolled
                      </div>
                    ) : (
                      <button onClick={() => handleEnroll(course._id)} disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">
                        Enroll Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allCourses.length === 0 && !loading && (
              <div className="text-center py-16 bg-white rounded-xl shadow-md">
                <Book size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg mb-4">No courses available</p>
                <button onClick={() => setShowCourseModal(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
                  Create First Course
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'my-courses' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">My Enrolled Courses</h2>
            <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Book size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Enrolled Courses</p>
                    <p className="text-2xl font-bold">{myCourses.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <CheckCircle size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Credits</p>
                    <p className="text-2xl font-bold">{myCourses.reduce((sum, c) => sum + (c.credits || 0), 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((course) => (
                <div key={course._id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                  <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500"></div>
                  <div className="p-6">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-2">
                      {course.courseCode}
                    </span>
                    <h4 className="text-xl font-bold mb-2">{course.title}</h4>
                    <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                    <div className="space-y-2 mb-4 text-sm text-gray-600">
                      <p><strong>Level:</strong> {course.level}</p>
                      <p><strong>Credits:</strong> {course.credits}</p>
                      <p><strong>Instructor:</strong> {course.instructor}</p>
                    </div>
                    <button onClick={() => handleUnenroll(course._id)} disabled={loading} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">
                      Unenroll
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {myCourses.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl shadow-md">
                <Book size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-xl mb-2">No enrolled courses yet</p>
                <button onClick={() => setCurrentView('dashboard')} className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700">
                  Browse Courses
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'profile' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Profile</h2>
            <div className="bg-white p-8 rounded-xl shadow-md space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID</label>
                <p className="p-4 bg-gray-50 rounded-lg font-mono text-lg">{user?.studentId}</p>
                <p className="text-sm text-gray-500 mt-2">Cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                <p className="p-4 bg-gray-50 rounded-lg text-lg">{user?.name}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <p className="p-4 bg-gray-50 rounded-lg text-lg">{user?.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};