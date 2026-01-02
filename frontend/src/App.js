// ============================================
// ENHANCED STUDENT PORTAL FRONTEND
// File: frontend/src/App.js
// ============================================

/* eslint-disable no-restricted-globals */
import React, { useState, useEffect } from 'react';
import './styles.css';  
import { LogOut, User, Book, Clock, CheckCircle } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export default function EnhancedStudentPortal() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [alert, setAlert] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  
  // Course states
  const [allCourses, setAllCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Session timer states
  const [sessionDuration, setSessionDuration] = useState(30 * 60);
  const [timeRemaining, setTimeRemaining] = useState(30 * 60);
  const [timerActive, setTimerActive] = useState(false);

  // ============================================
  // SESSION TIMER LOGIC
  // ============================================

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

  // ============================================
  // AUTHENTICATION
  // ============================================

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include'
      });
      
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
    setTimeout(() => setAlert(null), 3000);
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
        
        showAlert('Login successful!');
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
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
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

  // ============================================
  // COURSE MANAGEMENT
  // ============================================

  const fetchAllCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/courses`, {
        credentials: 'include'
      });
      
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
      const res = await fetch(`${API_URL}/courses/my`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setMyCourses(data.courses);
      }
    } catch (err) {
      showAlert('Failed to load your courses', 'error');
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

  // ============================================
  // RENDER: LOGIN/REGISTER
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-6 text-indigo-600">
            {isRegister ? 'Register' : 'Student Portal'}
          </h1>
          
          {alert && (
            <div className={`mb-4 p-3 rounded ${alert.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {alert.message}
            </div>
          )}

          {isRegister ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                className="w-full p-3 border rounded"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 border rounded"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                className="w-full p-3 border rounded"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
              />
              <button 
                onClick={handleRegister} 
                disabled={loading}
                className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
              <button 
                onClick={() => setIsRegister(false)} 
                className="w-full text-indigo-600 hover:underline"
              >
                Already have an account? Login
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 border rounded"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 border rounded"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button 
                onClick={handleLogin} 
                disabled={loading}
                className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <button 
                onClick={() => setIsRegister(true)} 
                className="w-full text-indigo-600 hover:underline"
              >
                Don't have an account? Register
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: DASHBOARD
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50">
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded shadow-lg ${alert.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          {alert.message}
        </div>
      )}

      <nav className="bg-indigo-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Student Portal</h1>
          
          <div className={`flex items-center gap-2 ${getTimerColor()} bg-white px-4 py-2 rounded-lg`}>
            <Clock size={20} />
            <span className="font-bold text-lg">{formatTime(timeRemaining)}</span>
          </div>

          <div className="flex gap-4 items-center">
            <button onClick={() => setCurrentView('dashboard')} className="hover:underline">
              Dashboard
            </button>
            <button onClick={() => setCurrentView('my-courses')} className="hover:underline">
              My Courses
            </button>
            <button onClick={() => setCurrentView('profile')} className="hover:underline flex items-center gap-2">
              <User size={20} /> Profile
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 hover:underline">
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-6">
        {currentView === 'dashboard' && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">Welcome, {user?.name}!</h2>
              <p className="text-gray-600">Student ID: {user?.studentId}</p>
              <p className="text-gray-600">Email: {user?.email}</p>
            </div>

            <div className="mb-6 p-4 bg-white rounded shadow">
              <h3 className="text-xl font-bold mb-2">Session Information</h3>
              <p className="text-gray-700">
                Time Remaining: <span className={`font-bold ${getTimerColor()}`}>{formatTime(timeRemaining)}</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Your session will automatically expire when the timer reaches 0:00
              </p>
            </div>

            <h3 className="text-2xl font-bold mb-4">Available Courses</h3>
            
            {loading && <p className="text-center">Loading courses...</p>}
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allCourses.map((course) => (
                <div key={course._id} className="bg-white p-6 rounded shadow hover:shadow-lg transition">
                  <div className="mb-4">
                    <h4 className="font-bold text-xl text-indigo-600">{course.courseCode}</h4>
                    <p className="text-gray-800 font-medium">{course.title}</p>
                    <p className="text-sm text-gray-600 mt-2">{course.description}</p>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p><strong>Level:</strong> {course.level}</p>
                    <p><strong>Credits:</strong> {course.credits}</p>
                    <p><strong>Instructor:</strong> {course.instructor}</p>
                    <p><strong>Schedule:</strong> {course.schedule}</p>
                  </div>

                  {isEnrolled(course._id) ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={20} />
                      <span className="font-medium">Enrolled</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course._id)}
                      disabled={loading}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Enroll Now
                    </button>
                  )}
                </div>
              ))}
            </div>

            {allCourses.length === 0 && !loading && (
              <p className="text-center text-gray-500">No courses available</p>
            )}
          </div>
        )}

        {currentView === 'my-courses' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">My Enrolled Courses</h2>
            
            <div className="mb-4 p-4 bg-white rounded shadow">
              <p className="text-lg">
                Total Credits: <span className="font-bold">{myCourses.reduce((sum, c) => sum + (c.credits || 0), 0)}</span>
              </p>
              <p className="text-lg">
                Enrolled Courses: <span className="font-bold">{myCourses.length}</span>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((course) => (
                <div key={course._id} className="bg-white p-6 rounded shadow">
                  <div className="mb-4">
                    <h4 className="font-bold text-xl text-indigo-600">{course.courseCode}</h4>
                    <p className="text-gray-800 font-medium">{course.title}</p>
                    <p className="text-sm text-gray-600 mt-2">{course.description}</p>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p><strong>Level:</strong> {course.level}</p>
                    <p><strong>Credits:</strong> {course.credits}</p>
                    <p><strong>Instructor:</strong> {course.instructor}</p>
                    <p><strong>Schedule:</strong> {course.schedule}</p>
                  </div>

                  <button
                    onClick={() => handleUnenroll(course._id)}
                    disabled={loading}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Unenroll
                  </button>
                </div>
              ))}
            </div>

            {myCourses.length === 0 && (
              <div className="text-center py-12">
                <Book size={64} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">You haven't enrolled in any courses yet</p>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700"
                >
                  Browse Courses
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'profile' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Profile</h2>
            
            <div className="bg-white p-6 rounded shadow space-y-4">
              <div>
                <label className="block font-medium text-gray-700 mb-2">Student ID</label>
                <p className="p-3 bg-gray-100 rounded">{user?.studentId}</p>
                <p className="text-sm text-gray-500 mt-1">Cannot be changed</p>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-2">Name</label>
                <p className="p-3 bg-gray-100 rounded">{user?.name}</p>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-2">Email</label>
                <p className="p-3 bg-gray-100 rounded">{user?.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}