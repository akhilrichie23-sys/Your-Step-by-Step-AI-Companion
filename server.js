import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Mongoose Schema for Task
const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, default: 'General' },
  goal: { type: String, default: '' },
  currentStepTitle: { type: String, default: 'Step 1' },
  currentStepNum: { type: Number, default: 1 },
  totalSteps: { type: Number, default: 5 },
  completedSteps: { type: Number, default: 0 },
  remainingSteps: { type: Number, default: 5 },
  status: { type: String, default: 'Active' },
  createdDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  updatedDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  safetyGuidelines: { type: String, default: '' },
  history: [
    {
      sender: { type: String, required: true },
      text: { type: String, default: '' },
      image: { type: String, default: null },
      status: { type: String, default: '' },
      step: { type: String, default: '' },
      why: { type: String, default: '' },
      safety: { type: String, default: null },
      promptForPhoto: { type: String, default: '' },
      stepNumber: { type: Number, default: 1 },
      timestamp: { type: String, default: '' }
    }
  ]
}, { timestamps: true });

const Task = mongoose.model('Task', TaskSchema);

// Connect to MongoDB
let isDbConnected = false;
mongoose.connect(MONGODB_URI)
  .then(() => {
    isDbConnected = true;
    console.log('✅ Connected to MongoDB Atlas successfully!');
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
  });

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: isDbConnected });
});

// GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ updatedAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
app.post('/api/tasks', async (req, res) => {
  try {
    const newTask = new Task(req.body);
    const saved = await newTask.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedDate: new Date().toISOString().split('T')[0] },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE clear messages in a task
app.delete('/api/tasks/:id/chat', async (req, res) => {
  try {
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { history: [], currentStepNum: 1, completedSteps: 0, remainingSteps: 5, status: 'Active' },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE delete whole task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 GUIDER Server running on http://localhost:${PORT}`);
});
