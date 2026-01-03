import React, { useState, useEffect } from 'react';
import './styles.css';
import { AlertCircle, LogOut, User, Book, Plus, Edit2, Trash2, Lock } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export default function StudentPortal() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [isRegister, setIsRegister] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [courseForm, setCourseForm] = useState({
    courseCode: '', courseName: '', description: '', credits: '', semester: '', instructor: '', schedule: ''
  });

  useEffect(() => {
    if (!token) return;

    const checkSession = async () => {
      try {
        await fetch(`${API_URL}/session/check`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        showAlert('Session expired. Please login again.', 'error');
        handleLogout();
      }
    };

    const interval = setInterval(checkSession, 30000);
    
    const updateActivity = () => {
      if (token) checkSession();
    };

    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchCourses();
    }
  }, [token]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUser(data);
      setProfileForm({ name: data.name, email: data.email });
    } catch (err) {
      showAlert('Failed to fetch profile', 'error');
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${API_URL}/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCourses(data);
    } catch (err) {
      showAlert('Failed to fetch courses', 'error');
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        showAlert('Login successful!');
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Login failed', 'error');
    }
  };

  const handleRegister = async () => {
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Registration successful! Please login.');
        setIsRegister(false);
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Registration failed', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {}
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCourses([]);
  };

  const handleSaveCourse = async () => {
    try {
      const url = editingCourse 
        ? `${API_URL}/courses/${editingCourse._id}`
        : `${API_URL}/courses`;
      const method = editingCourse ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({...courseForm, credits: parseInt(courseForm.credits)})
      });

      if (res.ok) {
        showAlert(editingCourse ? 'Course updated!' : 'Course added!');
        setShowModal(false);
        setEditingCourse(null);
        setCourseForm({
          courseCode: '', courseName: '', description: '', credits: '', semester: '', instructor: '', schedule: ''
        });
        fetchCourses();
      } else {
        showAlert('Failed to save course', 'error');
      }
    } catch (err) {
      showAlert('Error saving course', 'error');
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;

    try {
      const res = await fetch(`${API_URL}/courses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showAlert('Course deleted!');
        fetchCourses();
      } else {
        showAlert('Failed to delete course', 'error');
      }
    } catch (err) {
      showAlert('Error deleting course', 'error');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      });
      if (res.ok) {
        showAlert('Profile updated!');
        fetchProfile();
      } else {
        showAlert('Failed to update profile', 'error');
      }
    } catch (err) {
      showAlert('Error updating profile', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showAlert('Passwords do not match', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showAlert('Password must be at least 8 characters', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showAlert(data.error, 'error');
      }
    } catch (err) {
      showAlert('Error changing password', 'error');
    }
  };

  const openAddModal = () => {
    setEditingCourse(null);
    setCourseForm({
      courseCode: '', courseName: '', description: '', credits: '', semester: '', instructor: '', schedule: ''
    });
    setShowModal(true);
  };

  const openEditModal = (course) => {
    setEditingCourse(course);
    setCourseForm({
      courseCode: course.courseCode,
      courseName: course.courseName,
      description: course.description || '',
      credits: course.credits || '',
      semester: course.semester || '',
      instructor: course.instructor || '',
      schedule: course.schedule || ''
    });
    setShowModal(true);
  };

  if (!token) {
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
              <button onClick={handleRegister} className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700">
                Register
              </button>
              <button onClick={() => setIsRegister(false)} className="w-full text-indigo-600 hover:underline">
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
              />
              <button onClick={handleLogin} className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700">
                Login
              </button>
              <button onClick={() => setIsRegister(true)} className="w-full text-indigo-600 hover:underline">
                Don't have an account? Register
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
        <div className={`fixed top-4 right-4 z-50 p-4 rounded shadow-lg ${alert.type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          {alert.message}
        </div>
      )}

      <nav className="bg-indigo-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Student Portal</h1>
          <div className="flex gap-4 items-center">
            <button onClick={() => setCurrentView('dashboard')} className="hover:underline">Dashboard</button>
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">My Courses</h2>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-indigo-700"
              >
                <Plus size={20} /> Add Course
              </button>
            </div>

            <div className="mb-4 p-4 bg-white rounded shadow">
              <p className="text-lg">Total Credits: <span className="font-bold">{courses.reduce((sum, c) => sum + (c.credits || 0), 0)}</span></p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div key={course._id} className="bg-white p-6 rounded shadow hover:shadow-lg transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-indigo-600">{course.courseCode}</h3>
                      <p className="text-gray-600">{course.courseName}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(course)} className="text-blue-600 hover:text-blue-800">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteCourse(course._id)} className="text-red-600 hover:text-red-800">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{course.description}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Credits:</strong> {course.credits}</p>
                    <p><strong>Semester:</strong> {course.semester}</p>
                    <p><strong>Instructor:</strong> {course.instructor}</p>
                    <p><strong>Schedule:</strong> {course.schedule}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'profile' && user && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Profile</h2>
            
            <div className="bg-white p-6 rounded shadow mb-6">
              <h3 className="text-xl font-bold mb-4">Student Information</h3>
              <p><strong>Student ID:</strong> <span className="text-gray-600">{user.studentId}</span> <span className="text-sm text-gray-500">(Cannot be changed)</span></p>
            </div>

            <div className="bg-white p-6 rounded shadow mb-6">
              <h3 className="text-xl font-bold mb-4">Update Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium">Name</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full p-3 border rounded"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                  />
                </div>
                <button onClick={handleUpdateProfile} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
                  Update Profile
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Lock size={20} /> Change Password
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium">Current Password</label>
                  <input
                    type="password"
                    className="w-full p-3 border rounded"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">New Password</label>
                  <input
                    type="password"
                    className="w-full p-3 border rounded"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full p-3 border rounded"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  />
                </div>
                <button onClick={handleChangePassword} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
                  Change Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">{editingCourse ? 'Edit Course' : 'Add New Course'}</h3>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Course Code</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded"
                    value={courseForm.courseCode}
                    onChange={(e) => setCourseForm({...courseForm, courseCode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Credits</label>
                  <input
                    type="number"
                    className="w-full p-3 border rounded"
                    value={courseForm.credits}
                    onChange={(e) => setCourseForm({...courseForm, credits: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium">Course Name</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded"
                  value={courseForm.courseName}
                  onChange={(e) => setCourseForm({...courseForm, courseName: e.target.value})}
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Description</label>
                <textarea
                  className="w-full p-3 border rounded"
                  rows="3"
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Semester</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded"
                    value={courseForm.semester}
                    onChange={(e) => setCourseForm({...courseForm, semester: e.target.value})}
                    placeholder="e.g., Fall 2024"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Instructor</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded"
                    value={courseForm.instructor}
                    onChange={(e) => setCourseForm({...courseForm, instructor: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium">Schedule</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded"
                  value={courseForm.schedule}
                  onChange={(e) => setCourseForm({...courseForm, schedule: e.target.value})}
                  placeholder="e.g., Mon/Wed 9:00-10:30 AM"
                />
              </div>
              <div className="flex gap-4">
                <button onClick={handleSaveCourse} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
                  {editingCourse ? 'Update' : 'Add'} Course
                </button>
                <button
                  onClick={() => { setShowModal(false); setEditingCourse(null); }}
                  className="bg-gray-300 px-6 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}