// server.js - Enhanced Node.js + Express + MongoDB Backend with JWT Cookies
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000', // Frontend URL
  credentials: true // Allow cookies
}));

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student-portal';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
// MONGOOSE MODELS
// ============================================

// User Model
const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Course Model
const courseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  credits: Number,
  instructor: String,
  schedule: String,
  isActive: { type: Boolean, default: true },
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);

// Session Model - Tracks login sessions
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  loginTime: { type: Date, default: Date.now },
  expiryTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  lastActivity: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', sessionSchema);

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Middleware to verify JWT token from cookies
 * Attaches user object to req.user if valid
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Read JWT from cookie
    const token = req.cookies.auth_token;
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session is still active in database
    const session = await Session.findOne({ 
      token, 
      userId: decoded.userId,
      isActive: true 
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Check if session has expired
    if (new Date() > session.expiryTime) {
      session.isActive = false;
      await session.save();
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    // Update last activity
    session.lastActivity = new Date();
    await session.save();

    // Attach user to request
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.sessionId = session._id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

/**
 * POST /api/auth/register
 * Register a new student account
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate unique student ID
    const studentId = 'STU' + Date.now();

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      studentId,
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    res.status(201).json({ 
      message: 'Registration successful! Please login.',
      studentId 
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Login and create session with JWT cookie
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password with bcrypt
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Calculate expiry time (30 minutes from now)
    const expiryTime = new Date(Date.now() + SESSION_DURATION);

    // Generate JWT with expiration
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        studentId: user.studentId
      },
      JWT_SECRET,
      { expiresIn: '30m' } // 30 minutes
    );

    // Create session in database
    const session = new Session({
      userId: user._id,
      token,
      expiryTime
    });
    await session.save();

    // Set HTTP-only cookie with JWT
    res.cookie('auth_token', token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: SESSION_DURATION // 30 minutes
    });

    res.json({
      message: 'Login successful',
      user: {
        studentId: user.studentId,
        name: user.name,
        email: user.email
      },
      sessionDuration: SESSION_DURATION // Send duration to frontend for timer
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and clear session
 */
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    // Mark session as inactive
    await Session.findByIdAndUpdate(req.sessionId, { isActive: false });

    // Clear cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get currently logged-in user
 */
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      user: {
        studentId: req.user.studentId,
        name: req.user.name,
        email: req.user.email,
        enrolledCourses: req.user.enrolledCourses
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// ============================================
// COURSE ROUTES
// ============================================

/**
 * GET /api/courses
 * Get all available courses
 */
app.get('/api/courses', authMiddleware, async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true })
      .select('-enrolledStudents')
      .sort({ createdAt: -1 });
    
    res.json({ courses });
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * GET /api/courses/my
 * Get courses enrolled by current user
 */
app.get('/api/courses/my', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('enrolledCourses')
      .select('enrolledCourses');
    
    res.json({ courses: user.enrolledCourses });
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Failed to fetch your courses' });
  }
});

/**
 * POST /api/courses/enroll
 * Enroll in a course
 */
app.post('/api/courses/enroll', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // Find course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!course.isActive) {
      return res.status(400).json({ error: 'This course is not available' });
    }

    // Check if already enrolled
    if (req.user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Add course to user's enrolled courses
    await User.findByIdAndUpdate(req.user._id, {
      $push: { enrolledCourses: courseId }
    });

    // Add user to course's enrolled students
    await Course.findByIdAndUpdate(courseId, {
      $push: { enrolledStudents: req.user._id }
    });

    res.json({ 
      message: 'Successfully enrolled in course',
      course: {
        id: course._id,
        title: course.title,
        courseCode: course.courseCode
      }
    });
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

/**
 * POST /api/courses/unenroll
 * Unenroll from a course
 */
app.post('/api/courses/unenroll', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // Remove course from user's enrolled courses
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { enrolledCourses: courseId }
    });

    // Remove user from course's enrolled students
    await Course.findByIdAndUpdate(courseId, {
      $pull: { enrolledStudents: req.user._id }
    });

    res.json({ message: 'Successfully unenrolled from course' });
  } catch (err) {
    console.error('Unenroll error:', err);
    res.status(500).json({ error: 'Unenrollment failed' });
  }
});

/**
 * POST /api/courses (Admin only - for demo purposes)
 * Create a new course
 */
app.post('/api/courses', authMiddleware, async (req, res) => {
  try {
    const { courseCode, title, description, level, credits, instructor, schedule } = req.body;

    const course = new Course({
      courseCode,
      title,
      description,
      level,
      credits,
      instructor,
      schedule
    });

    await course.save();

    res.status(201).json({ 
      message: 'Course created successfully',
      course 
    });
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// ============================================
// BACKGROUND SESSION CLEANUP
// ============================================

/**
 * Clean up expired sessions every 5 minutes
 */
setInterval(async () => {
  try {
    const result = await Session.updateMany(
      { 
        expiryTime: { $lt: new Date() },
        isActive: true 
      },
      { isActive: false }
    );
    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned up ${result.modifiedCount} expired sessions`);
    }
  } catch (err) {
    console.error('Session cleanup error:', err);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 MongoDB URI: ${MONGODB_URI}`);
  console.log(`⏱️  Session duration: ${SESSION_DURATION / 1000 / 60} minutes`);
});