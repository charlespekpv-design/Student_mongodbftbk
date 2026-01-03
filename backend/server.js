const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student-portal';
const SESSION_DURATION = 30 * 60 * 1000;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

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

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  loginTime: { type: Date, default: Date.now },
  expiryTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  lastActivity: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);
const Session = mongoose.model('Session', sessionSchema);

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'No authentication token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await Session.findOne({ token, userId: decoded.userId, isActive: true });
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    if (new Date() > session.expiryTime) {
      session.isActive = false;
      await session.save();
      return res.status(401).json({ error: 'Session expired' });
    }

    session.lastActivity = new Date();
    await session.save();

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    req.sessionId = session._id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password min 8 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const studentId = 'STU' + Date.now();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ studentId, name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'Registration successful', studentId });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const expiryTime = new Date(Date.now() + SESSION_DURATION);
    const token = jwt.sign({ userId: user._id, email: user.email, studentId: user.studentId }, JWT_SECRET, { expiresIn: '30m' });

    const session = new Session({ userId: user._id, token, expiryTime });
    await session.save();

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION
    });

    res.json({
      message: 'Login successful',
      user: { studentId: user.studentId, name: user.name, email: user.email },
      sessionDuration: SESSION_DURATION
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await Session.findByIdAndUpdate(req.sessionId, { isActive: false });
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

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
    res.status(500).json({ error: 'Failed to get user' });
  }
});

app.get('/api/courses', authMiddleware, async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true }).select('-enrolledStudents').sort({ createdAt: -1 });
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

app.get('/api/courses/my', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('enrolledCourses').select('enrolledCourses');
    res.json({ courses: user.enrolledCourses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your courses' });
  }
});

app.post('/api/courses/enroll', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'Course ID required' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!course.isActive) return res.status(400).json({ error: 'Course not available' });
    if (req.user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ error: 'Already enrolled' });
    }

    await User.findByIdAndUpdate(req.user._id, { $push: { enrolledCourses: courseId } });
    await Course.findByIdAndUpdate(courseId, { $push: { enrolledStudents: req.user._id } });

    res.json({ message: 'Successfully enrolled', course: { id: course._id, title: course.title, courseCode: course.courseCode } });
  } catch (err) {
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

app.post('/api/courses/unenroll', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'Course ID required' });

    await User.findByIdAndUpdate(req.user._id, { $pull: { enrolledCourses: courseId } });
    await Course.findByIdAndUpdate(courseId, { $pull: { enrolledStudents: req.user._id } });

    res.json({ message: 'Successfully unenrolled' });
  } catch (err) {
    res.status(500).json({ error: 'Unenrollment failed' });
  }
});

app.post('/api/courses', authMiddleware, async (req, res) => {
  try {
    const { courseCode, title, description, level, credits, instructor, schedule } = req.body;
    const course = new Course({ courseCode, title, description, level, credits, instructor, schedule });
    await course.save();
    res.status(201).json({ message: 'Course created', course });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Course code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create course' });
    }
  }
});

app.delete('/api/courses/:id', authMiddleware, async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    await User.updateMany(
      { enrolledCourses: req.params.id },
      { $pull: { enrolledCourses: req.params.id } }
    );
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

setInterval(async () => {
  try {
    const result = await Session.updateMany(
      { expiryTime: { $lt: new Date() }, isActive: true },
      { isActive: false }
    );
    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned ${result.modifiedCount} expired sessions`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⏱️  Session duration: ${SESSION_DURATION / 1000 / 60} minutes`);
});