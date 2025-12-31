// server.js - Node.js + Express + MongoDB Backend
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student-portal';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schemas
const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const courseSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  description: String,
  credits: Number,
  semester: String,
  instructor: String,
  schedule: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  token: { type: String, required: true },
  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const Session = mongoose.model('Session', sessionSchema);

// Middleware to verify token and check session
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await Session.findOne({ 
      studentId: decoded.studentId, 
      token, 
      isActive: true 
    });

    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

    // Check if session expired (5 minutes)
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const diffMinutes = (now - lastActivity) / 1000 / 60;

    if (diffMinutes > 5) {
      session.isActive = false;
      await session.save();
      return res.status(401).json({ error: 'Session expired due to inactivity' });
    }

    // Update last activity
    session.lastActivity = now;
    await session.save();

    req.studentId = decoded.studentId;
    req.sessionId = session._id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Background job to clean up expired sessions
setInterval(async () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await Session.updateMany(
    { lastActivity: { $lt: fiveMinutesAgo }, isActive: true },
    { isActive: false }
  );
}, 30000); // Run every 30 seconds

// ROUTES

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Generate unique student ID
    const studentId = 'STU' + Date.now();
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const student = new Student({
      studentId,
      name,
      email,
      password: hashedPassword
    });
    
    await student.save();
    res.status(201).json({ message: 'Student registered successfully', studentId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const student = await Student.findOne({ email });
    if (!student) return res.status(401).json({ error: 'Invalid credentials' });
    
    const validPassword = await bcrypt.compare(password, student.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Create token
    const token = jwt.sign({ studentId: student.studentId }, JWT_SECRET, { expiresIn: '24h' });
    
    // Create session
    const session = new Session({
      studentId: student.studentId,
      token
    });
    await session.save();
    
    res.json({ 
      token, 
      studentId: student.studentId,
      name: student.name,
      email: student.email
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
app.post('/api/logout', authenticate, async (req, res) => {
  try {
    await Session.findByIdAndUpdate(req.sessionId, { isActive: false });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student profile
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.studentId }).select('-password');
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update student profile (name and email only)
app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;
    const student = await Student.findOneAndUpdate(
      { studentId: req.studentId },
      { name, email, updatedAt: Date.now() },
      { new: true }
    ).select('-password');
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Change password
app.put('/api/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const student = await Student.findOne({ studentId: req.studentId });
    const validPassword = await bcrypt.compare(currentPassword, student.password);
    
    if (!validPassword) return res.status(401).json({ error: 'Current password is incorrect' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    student.password = hashedPassword;
    student.updatedAt = Date.now();
    await student.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// COURSE CRUD OPERATIONS

// Create course
app.post('/api/courses', authenticate, async (req, res) => {
  try {
    const course = new Course({
      ...req.body,
      studentId: req.studentId
    });
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all courses for student
app.get('/api/courses', authenticate, async (req, res) => {
  try {
    const courses = await Course.find({ studentId: req.studentId });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single course
app.get('/api/courses/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findOne({ 
      _id: req.params.id, 
      studentId: req.studentId 
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update course
app.put('/api/courses/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, studentId: req.studentId },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete course
app.delete('/api/courses/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ 
      _id: req.params.id, 
      studentId: req.studentId 
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check session activity
app.get('/api/session/check', authenticate, async (req, res) => {
  res.json({ active: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));