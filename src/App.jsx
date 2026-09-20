import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Camera,
  PenTool,
  Mic,
  MicOff,
  Plus,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  Settings as SettingsIcon,
  Globe,
  HelpCircle,
  Send,
  Upload,
  Check,
  RotateCcw,
  Eye,
  AlertTriangle,
  ListTodo,
  Trash2,
  MessageSquarePlus,
  MessageSquare,
  Eraser,
  Database
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES } from './data/initialTasks';
import { TRANSLATIONS } from './data/translations';
import { analyzeWithGuider } from './services/aiService';
import { taskApi } from './services/taskApi';

export default function App() {
  // Navigation: 'home' | 'chat' | 'check_work' | 'new_task' | 'tasks_list' | 'task_details' | 'profile' | 'settings'
  const [activeTab, setActiveTab] = useState('home');
  const [lang, setLang] = useState(() => localStorage.getItem('guider_lang') || 'en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);
  const [dbConnected, setDbConnected] = useState(true);

  // Settings State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('guider_api_key') || '');
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Chat & Multimodal State
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [whyModal, setWhyModal] = useState(null);
  const [imagePreviewModal, setImagePreviewModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  // Camera capture modal
  const [cameraModal, setCameraModal] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState(CATEGORIES[0]);
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [newTaskInitialImage, setNewTaskInitialImage] = useState(null);

  // Load tasks on startup from MongoDB
  useEffect(() => {
    taskApi.getTasks().then(data => {
      setTasks(data || []);
      if (data && data.length > 0) {
        const firstId = data[0]._id || data[0].id;
        setActiveTaskId(firstId);
      }
    });
  }, []);

  // Sync tasks to LocalStorage backup
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('guider_tasks_v3', JSON.stringify(tasks));
    }
  }, [tasks]);

  // Scroll to bottom on new chat messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tasks, activeTab, isProcessing]);

  const activeTask = tasks.find(t => (t._id === activeTaskId || t.id === activeTaskId)) || tasks[0] || null;

  const handleLanguageChange = (code) => {
    setLang(code);
    localStorage.setItem('guider_lang', code);
  };

  // --- Web Speech API ---
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition isn't supported in this browser. Please try Google Chrome or Safari.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
    recognition.interimResults = false;

    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const speech = event.results[0][0].transcript;
      setInputText(prev => prev ? `${prev} ${speech}` : speech);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  // --- Camera Viewfinder ---
  const openLiveCamera = async () => {
    setCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.warn("Camera fallback active:", e);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      setSelectedImage(canvas.toDataURL('image/jpeg', 0.85));
      stopCameraStream();
    } else {
      setSelectedImage("https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80");
    }
    setCameraModal(false);
  };

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // --- Send Message & Step Reasoning ---
  const handleSendMessage = async (customPrompt = null, customImg = null) => {
    const textToSend = customPrompt !== null ? customPrompt : inputText;
    const imgToSend = customImg !== null ? customImg : selectedImage;

    if (!textToSend && !imgToSend) return;

    let currentTarget = activeTask;
    // If no active task exists, create a default blank one
    if (!currentTarget) {
      const autoCreated = await taskApi.createTask({
        title: textToSend.slice(0, 30) || 'My Project',
        category: 'General',
        goal: textToSend,
        currentStepTitle: 'Starting Project',
        currentStepNum: 1,
        totalSteps: 5,
        completedSteps: 0,
        remainingSteps: 5,
        status: 'Active',
        history: []
      });
      setTasks([autoCreated]);
      setActiveTaskId(autoCreated._id || autoCreated.id);
      currentTarget = autoCreated;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage = {
      sender: 'user',
      text: textToSend,
      image: imgToSend,
      timestamp: time
    };

    const targetId = currentTarget._id || currentTarget.id;
    const updatedHistory = [...(currentTarget.history || []), userMessage];
    const updatedTask = {
      ...currentTarget,
      history: updatedHistory,
      updatedDate: new Date().toISOString().split('T')[0]
    };

    setTasks(prev => prev.map(t => (t._id === targetId || t.id === targetId) ? updatedTask : t));
    setInputText('');
    setSelectedImage(null);
    setIsProcessing(true);

    try {
      const aiResponse = await analyzeWithGuider({
        prompt: textToSend,
        image: imgToSend,
        task: updatedTask,
        apiKey,
        safetyEnabled
      });

      if (aiResponse.isCompleted) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      }

      const aiMessage = {
        sender: 'guider',
        status: aiResponse.status,
        step: aiResponse.step,
        why: aiResponse.why,
        safety: aiResponse.safety,
        promptForPhoto: aiResponse.promptForPhoto,
        stepNumber: aiResponse.stepNumber,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalizedTask = {
        ...updatedTask,
        currentStepNum: aiResponse.isCompleted ? updatedTask.totalSteps : Math.min(updatedTask.totalSteps, updatedTask.currentStepNum + 1),
        completedSteps: Math.min(updatedTask.totalSteps, updatedTask.completedSteps + 1),
        remainingSteps: Math.max(0, updatedTask.totalSteps - (aiResponse.stepNumber || updatedTask.currentStepNum + 1)),
        status: aiResponse.isCompleted ? 'Completed' : 'Active',
        history: [...updatedHistory, aiMessage]
      };

      setTasks(prev => prev.map(t => (t._id === targetId || t.id === targetId) ? finalizedTask : t));
      
      // Persist to MongoDB
      if (currentTarget._id) {
        taskApi.updateTask(currentTarget._id, finalizedTask);
      }
    } catch (err) {
      console.error("AI Generation error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Create Task ---
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    const taskPayload = {
      title: newTaskTitle.trim(),
      category: newTaskCategory,
      goal: newTaskGoal.trim() || 'Complete project with GUIDER assistance',
      currentStepTitle: 'Initial Setup & Materials Verification',
      currentStepNum: 1,
      totalSteps: 5,
      completedSteps: 0,
      remainingSteps: 5,
      status: 'Active',
      history: []
    };

    if (newTaskInitialImage) {
      taskPayload.history.push({
        sender: 'user',
        text: `Starting new task: ${taskPayload.title}. Here are my starting materials.`,
        image: newTaskInitialImage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    const saved = await taskApi.createTask(taskPayload);
    const newId = saved._id || saved.id || ('task-' + Date.now());
    const completeTask = { ...taskPayload, _id: newId, id: newId };

    setTasks(prev => [completeTask, ...prev]);
    setActiveTaskId(newId);
    setNewTaskTitle('');
    setNewTaskGoal('');
    setNewTaskInitialImage(null);
    setActiveTab('chat');

    setTimeout(() => {
      handleSendMessage("GUIDER, I am beginning this project. What is my first step?");
    }, 200);
  };

  // --- Clear Current Chat Messages ---
  const handleClearCurrentChat = () => {
    if (!activeTask) return;
    setConfirmModal({
      title: "Clear Conversation History?",
      message: "This will remove the current messages and reset your progress back to Step 1. Your project goal and title will stay safe.",
      confirmText: "Yes, Clear Chat",
      icon: "eraser",
      onConfirm: async () => {
        const targetId = activeTask._id || activeTask.id;
        const resetTask = {
          ...activeTask,
          history: [],
          currentStepNum: 1,
          completedSteps: 0,
          remainingSteps: activeTask.totalSteps || 5,
          status: 'Active'
        };

        setTasks(prev => prev.map(t => (t._id === targetId || t.id === targetId) ? resetTask : t));
        if (activeTask._id) {
          await taskApi.clearChat(activeTask._id);
        }
        setConfirmModal(null);
      }
    });
  };

  // --- Delete Whole Task ---
  const handleDeleteTask = (id, e) => {
    if (e) e.stopPropagation();
    setConfirmModal({
      title: "Delete This Project?",
      message: "This project and all associated steps and photos will be permanently deleted from MongoDB Atlas.",
      confirmText: "Delete Project",
      isDestructive: true,
      icon: "trash",
      onConfirm: async () => {
        const remaining = tasks.filter(t => (t._id !== id && t.id !== id));
        setTasks(remaining);
        if ((activeTaskId === id) && remaining.length > 0) {
          setActiveTaskId(remaining[0]._id || remaining[0].id);
        } else if (remaining.length === 0) {
          setActiveTaskId(null);
        }
        if (selectedTaskForDetails?._id === id || selectedTaskForDetails?.id === id) {
          setSelectedTaskForDetails(null);
          setActiveTab('tasks_list');
        }
        await taskApi.deleteTask(id);
        setConfirmModal(null);
      }
    });
  };

  return (
    <div className="flex h-screen w-full bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ===================== SIDEBAR ===================== */}
      <aside className="w-64 bg-[#0b1122] border-r border-slate-800/80 flex flex-col justify-between hidden md:flex shrink-0 z-30">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center shadow-glow-emerald">
                <Compass className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-extrabold tracking-tight text-white">GUIDER</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
                  AI Companion
                </p>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'home' 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'chat' 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Compass className="w-4 h-4 text-teal-400" />
                <span>GUIDER Chat</span>
              </div>
              {activeTask?.status === 'Active' && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                  Step {activeTask.currentStepNum}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('new_task')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'new_task' 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <MessageSquarePlus className="w-4 h-4 text-cyan-400" />
              <span>New Conversation</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks_list')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'tasks_list' 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ListTodo className="w-4 h-4 text-slate-400" />
                <span>My Projects</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">{tasks.length}</span>
            </button>
          </nav>

          {/* Recent Conversations / Chats in Sidebar */}
          <div className="px-4 py-2 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
              <span>Recent Chats</span>
              <span className="text-slate-500 font-mono">{tasks.length}</span>
            </div>

            {tasks.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-850 text-center text-[11px] text-slate-500">
                No chats yet
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {tasks.map(task => {
                  const taskId = task._id || task.id;
                  const isActive = (activeTaskId === taskId && activeTab === 'chat');
                  return (
                    <div
                      key={taskId}
                      onClick={() => {
                        setActiveTaskId(taskId);
                        setActiveTab('chat');
                      }}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-850/60 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0 pr-2">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                        <span className="truncate font-medium">{task.title || 'Untitled Chat'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(taskId, e)}
                        title="Delete chat"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Settings & Database Status */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-400">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>MongoDB Atlas Connected</span>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'settings' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>{t.settingsTitle}</span>
          </button>

          <div className="flex items-center justify-between px-3.5 py-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Language:</span>
            </div>
            <div className="flex space-x-1">
              {['en', 'es', 'fr'].map(code => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    lang === code ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT ===================== */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Top Navbar Header */}
        <header className="glass-header px-6 py-3.5 flex justify-between items-center z-20 shrink-0">
          <div className="flex items-center space-x-3">
            <div 
              onClick={() => setActiveTab('home')}
              className="md:hidden flex items-center space-x-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xs">
                G
              </div>
              <span className="font-bold text-sm text-white">GUIDER</span>
            </div>

            <div className="hidden md:block">
              <h1 className="text-sm font-bold text-white capitalize">
                {activeTab === 'home' ? t.tagline : activeTab.replace('_', ' ')}
              </h1>
              <p className="text-[11px] text-slate-400">
                {activeTask ? `Current Project: ${activeTask.title}` : 'Ready for your first project'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'chat' && activeTask && (
              <button
                onClick={handleClearCurrentChat}
                title="Clear current chat"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('new_task')}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>New Project</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold transition border border-slate-700"
              title="Profile"
            >
              🚀
            </button>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto relative">

          {/* ---------------- 1. DASHBOARD / HOME ---------------- */}
          {activeTab === 'home' && (
            <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-fadeIn">
              
              {/* Hero Banner */}
              <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 space-y-3 max-w-2xl">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold tracking-wider uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      Step-by-Step AI Companion
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-400">Database Connected</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {t.heroTitle}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    {t.heroSub}
                  </p>
                </div>
              </div>

              {/* 4 Action Launchers */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                  Start an action:
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      setTimeout(() => openLiveCamera(), 200);
                    }}
                    className="p-5 glass-panel hover:border-emerald-500/60 rounded-2xl flex flex-col items-center text-center group transition shadow-lg active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-500/20 transition">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-white mb-0.5">📷 {t.showMe}</span>
                    <span className="text-[10px] text-slate-400">{t.showMeDesc}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('chat')}
                    className="p-5 glass-panel hover:border-teal-500/60 rounded-2xl flex flex-col items-center text-center group transition shadow-lg active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-teal-500/20 transition">
                      <PenTool className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-white mb-0.5">✍️ {t.askGuider}</span>
                    <span className="text-[10px] text-slate-400">{t.askGuiderDesc}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      setTimeout(() => toggleSpeechRecognition(), 200);
                    }}
                    className="p-5 glass-panel hover:border-cyan-500/60 rounded-2xl flex flex-col items-center text-center group transition shadow-lg active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-cyan-500/20 transition">
                      <Mic className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-white mb-0.5">🎤 {t.speak}</span>
                    <span className="text-[10px] text-slate-400">{t.speakDesc}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('new_task')}
                    className="p-5 bg-gradient-to-b from-emerald-950/40 to-[#0e172d] border border-emerald-500/40 hover:border-emerald-400 rounded-2xl flex flex-col items-center text-center group transition shadow-lg active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center mb-3 group-hover:scale-110 shadow-glow-emerald transition">
                      <Plus className="w-6 h-6 stroke-[3]" />
                    </div>
                    <span className="text-xs font-bold text-emerald-300 mb-0.5">➕ {t.startNew}</span>
                    <span className="text-[10px] text-emerald-400/80">{t.startNewDesc}</span>
                  </button>
                </div>
              </div>

              {/* Active Task Card */}
              {activeTask ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {t.activeTask}
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      {activeTask.category}
                    </span>
                  </div>

                  <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white">{activeTask.title}</h3>
                        <p className="text-xs text-slate-300 mt-1 max-w-xl">{activeTask.goal}</p>
                      </div>
                      <div className="flex items-center space-x-2 self-start md:self-auto">
                        <span className="text-xs font-bold text-emerald-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
                          Step {activeTask.currentStepNum} of {activeTask.totalSteps}
                        </span>
                        <button
                          onClick={() => setActiveTab('chat')}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5"
                        >
                          <span>{t.continueTask}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
                      <div
                        className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(activeTask.currentStepNum / activeTask.totalSteps) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <div className="flex items-center space-x-1.5">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span>Current Stage: <strong className="text-slate-200">{activeTask.currentStepTitle || 'Active Guided Phase'}</strong></span>
                      </div>
                      <span>Updated {activeTask.updatedDate}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-8 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Compass className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">No active project right now</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Click "New Task" or "Ask GUIDER" above to begin your first guided project!
                  </p>
                  <button
                    onClick={() => setActiveTab('new_task')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                  >
                    Create My First Task
                  </button>
                </div>
              )}

              {/* All Recent Conversations & Projects */}
              {tasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      My Previous Chats & Projects ({tasks.length})
                    </span>
                    <button onClick={() => setActiveTab('tasks_list')} className="text-xs text-emerald-400 hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {tasks.map(task => {
                      const taskId = task._id || task.id;
                      return (
                        <div
                          key={taskId}
                          onClick={() => {
                            setActiveTaskId(taskId);
                            setActiveTab('chat');
                          }}
                          className="glass-panel p-4 rounded-2xl hover:border-slate-700 cursor-pointer transition space-y-2.5 relative group"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-emerald-400/90 uppercase">{task.category}</span>
                            <div className="flex items-center space-x-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${task.status === 'Completed' ? 'bg-teal-500/20 text-teal-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {task.status}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTask(taskId, e)}
                                title="Delete project"
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">{task.title}</h4>
                          <div className="text-[11px] text-slate-400 flex justify-between items-center pt-2 border-t border-slate-800">
                            <span>{task.completedSteps || 0}/{task.totalSteps || 5} steps</span>
                            <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                              <span>Open</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------- 2. GUIDER CHAT ---------------- */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
              
              {/* Chat Sub-Header */}
              <div className="bg-[#0c1326] px-6 py-3 border-b border-slate-800/80 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    Step {activeTask?.currentStepNum || 1} / {activeTask?.totalSteps || 5}
                  </span>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">{activeTask?.title || 'New Conversation'}</h3>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{activeTask?.goal || 'Describe what you are working on'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClearCurrentChat}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition"
                  >
                    <Eraser className="w-3.5 h-3.5 text-slate-400" />
                    <span>Clear</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('check_work')}
                    className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center space-x-1 transition"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Check Work</span>
                  </button>
                </div>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                {(!activeTask || !activeTask.history || activeTask.history.length === 0) && (
                  <div className="text-center py-16 px-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                      <Compass className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-white">Start your project step-by-step</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Send a photo, speak into the mic, or describe what you have done so far. GUIDER will give you ONE clear next action.
                    </p>
                  </div>
                )}

                {activeTask?.history?.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fadeIn`}>
                    {msg.sender === 'user' ? (
                      <div className="max-w-[85%] md:max-w-[70%] bg-[#15223f] text-slate-100 rounded-3xl rounded-tr-md p-4 border border-slate-700/80 shadow-md text-xs space-y-2">
                        {msg.image && (
                          <div 
                            onClick={() => setImagePreviewModal(msg.image)}
                            className="rounded-2xl overflow-hidden border border-slate-600/80 shadow max-h-60 cursor-pointer group relative"
                          >
                            <img src={msg.image} className="w-full h-full object-cover group-hover:scale-105 transition" alt="User progress" />
                            <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur">
                              🔍 Expand
                            </div>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <span className="text-[10px] text-slate-400 block text-right font-mono">{msg.timestamp}</span>
                      </div>
                    ) : (
                      <div className="max-w-[95%] md:max-w-[85%] glass-panel rounded-3xl rounded-tl-md p-5 text-xs space-y-4 shadow-xl border border-slate-800">
                        {/* 1. STATUS */}
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 mb-1.5">
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t.currentStatus}</span>
                          </div>
                          <div className="text-slate-200 bg-[#090e1c] p-3 rounded-2xl border border-slate-800/80 leading-relaxed text-xs">
                            {msg.status}
                          </div>
                        </div>

                        {/* 2. NEXT STEP */}
                        <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-[#0f1b33] to-teal-950/30 border border-emerald-500/40 rounded-2xl shadow-inner">
                          <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5 mb-2">
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
                            <span>{t.nextStep}</span>
                          </div>
                          <div className="text-white font-bold text-sm md:text-base leading-snug">
                            {msg.step}
                          </div>
                        </div>

                        {/* 3. WHY */}
                        <div className="text-slate-300 bg-slate-800/40 p-3 rounded-2xl border border-slate-800/60 flex items-start space-x-2.5">
                          <span className="text-emerald-400 font-extrabold text-[10px] uppercase tracking-wide shrink-0 mt-0.5">
                            {t.why}:
                          </span>
                          <span className="text-xs leading-relaxed text-slate-300">{msg.why}</span>
                        </div>

                        {/* 4. SAFETY */}
                        {msg.safety && safetyEnabled && (
                          <div className="text-amber-200 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs flex items-start space-x-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-amber-300 block text-[10px] uppercase font-bold">{t.safetyWarning}</strong>
                              <span>{msg.safety}</span>
                            </div>
                          </div>
                        )}

                        {/* 5. VERIFICATION PROMPT */}
                        {msg.promptForPhoto && (
                          <div className="text-xs text-emerald-400/90 font-medium italic flex items-center space-x-2 px-1">
                            <Camera className="w-3.5 h-3.5" />
                            <span>{msg.promptForPhoto}</span>
                          </div>
                        )}

                        {/* 6. ACTION BUTTONS */}
                        <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-800">
                          <button
                            onClick={() => handleSendMessage("I completed this step! Here is my progress update.", selectedImage)}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center space-x-1.5 transition active:scale-95 shadow-md shadow-emerald-500/20"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{t.iDidIt}</span>
                          </button>

                          <button
                            onClick={() => setActiveTab('check_work')}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{t.showResult}</span>
                          </button>

                          <button
                            onClick={() => setWhyModal({ step: msg.step, why: msg.why })}
                            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                          >
                            ❓ {t.whyBtn}
                          </button>

                          <button
                            onClick={() => handleSendMessage("Can you give me an alternative approach or troubleshoot this?")}
                            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                          >
                            💬 {t.askSomething}
                          </button>

                          <button
                            onClick={() => handleSendMessage("Skip this step and proceed to the next milestone.")}
                            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs transition"
                          >
                            ⏭️ {t.skipStep}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex items-center space-x-3 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl w-fit text-xs text-slate-300 animate-pulse">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 animate-spin" />
                    </div>
                    <span className="font-medium">GUIDER is assessing your current situation...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-[#0c1326]/95 border-t border-slate-800/90 backdrop-blur-md shrink-0">
                {selectedImage && (
                  <div className="relative w-24 h-24 mb-3 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl">
                    <img src={selectedImage} className="w-full h-full object-cover" alt="Attached preview" />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-1 right-1 bg-slate-950/90 hover:bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs transition"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={openLiveCamera}
                    title="Camera"
                    className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center border border-slate-700 transition shrink-0"
                  >
                    <Camera className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload"
                    className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition shrink-0"
                  >
                    <Upload className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    title="Speak"
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition shrink-0 ${
                      isListening 
                        ? 'bg-red-500 text-white border-red-400 animate-pulse' 
                        : 'bg-slate-800 text-cyan-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <input
                    type="text"
                    placeholder={t.typePlaceholder}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 bg-[#070c18] border border-slate-800 rounded-2xl px-4 py-3 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText && !selectedImage}
                    className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-bold flex items-center justify-center transition active:scale-95 shadow-glow-emerald shrink-0"
                  >
                    <Send className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 3. CHECK MY WORK ---------------- */}
          {activeTab === 'check_work' && (
            <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-white">{t.checkWorkTitle}</h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto">{t.checkWorkSub}</p>
              </div>

              <div className="glass-panel p-6 rounded-3xl space-y-4">
                {selectedImage ? (
                  <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-emerald-500 shadow-lg">
                    <img src={selectedImage} className="w-full h-full object-cover" alt="Captured work" />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-3 right-3 bg-slate-950/80 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 py-6">
                    <button
                      onClick={openLiveCamera}
                      className="p-6 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 rounded-3xl flex flex-col items-center justify-center text-slate-300 hover:text-emerald-400 transition group"
                    >
                      <Camera className="w-8 h-8 mb-2 text-emerald-400 group-hover:scale-110 transition" />
                      <span className="text-xs font-bold">{t.startCamera}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Use camera</span>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 bg-slate-900 border border-dashed border-slate-700 hover:border-teal-500 rounded-3xl flex flex-col items-center justify-center text-slate-300 hover:text-teal-400 transition group"
                    >
                      <Upload className="w-8 h-8 mb-2 text-teal-400 group-hover:scale-110 transition" />
                      <span className="text-xs font-bold">{t.uploadPhoto}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">From gallery</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Optional context note:</label>
                  <input
                    type="text"
                    placeholder="e.g. 'I let it cure for 15 minutes'..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300">
                  <div className="font-bold">{t.goodStatus}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Proceed immediately</div>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300">
                  <div className="font-bold">{t.improveStatus}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Guided correction</div>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300">
                  <div className="font-bold">{t.unclearStatus}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Clarification prompt</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveTab('chat');
                  handleSendMessage("Here is my work photo to verify.", selectedImage);
                }}
                disabled={!selectedImage && !inputText}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-2xl shadow-glow-emerald transition"
              >
                Submit for Instant AI Verification
              </button>
            </div>
          )}

          {/* ---------------- 4. CREATE NEW TASK / CONVERSATION ---------------- */}
          {activeTab === 'new_task' && (
            <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white">Start a New Project / Chat</h2>
                <p className="text-xs text-slate-400 mt-0.5">Enter your project title and what you plan to accomplish</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Project Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Sourdough Bread, Robotics Assembly, Wooden Planter..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewTaskCategory(cat)}
                        className={`py-2.5 px-3 rounded-xl border text-[11px] font-semibold transition ${
                          newTaskCategory === cat 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Desired Goal / Final Product</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what you want to achieve or build..."
                    value={newTaskGoal}
                    onChange={(e) => setNewTaskGoal(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Starting Photo (Optional)</label>
                  {newTaskInitialImage ? (
                    <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-emerald-500">
                      <img src={newTaskInitialImage} className="w-full h-full object-cover" alt="Starting preview" />
                      <button
                        onClick={() => setNewTaskInitialImage(null)}
                        className="absolute top-2 right-2 bg-slate-950/80 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 transition"
                      >
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-bold">Upload Materials Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={openLiveCamera}
                        className="p-4 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 transition"
                      >
                        <Camera className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-bold">Snap Camera Photo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim()}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-2xl shadow-glow-emerald transition"
              >
                Launch New Project
              </button>
            </div>
          )}

          {/* ---------------- 5. ALL TASKS LIST ---------------- */}
          {activeTab === 'tasks_list' && (
            <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">My Projects & History</h2>
                  <p className="text-xs text-slate-400">All registered projects stored in MongoDB Atlas</p>
                </div>
                <button
                  onClick={() => setActiveTab('new_task')}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="glass-panel p-10 rounded-3xl text-center space-y-3">
                  <p className="text-slate-400 text-xs">No projects created yet. Start something fresh!</p>
                  <button
                    onClick={() => setActiveTab('new_task')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                  >
                    Create Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tasks.map(task => {
                    const taskId = task._id || task.id;
                    return (
                      <div
                        key={taskId}
                        onClick={() => {
                          setActiveTaskId(taskId);
                          setActiveTab('chat');
                        }}
                        className="glass-panel p-5 rounded-3xl space-y-3 hover:border-slate-700 transition cursor-pointer relative group"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{task.category}</span>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${task.status === 'Completed' ? 'bg-teal-500/20 text-teal-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {task.status}
                            </span>
                            <button
                              onClick={(e) => handleDeleteTask(taskId, e)}
                              title="Delete project"
                              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">{task.title}</h3>
                        <p className="text-xs text-slate-300 line-clamp-2">{task.goal}</p>

                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full rounded-full"
                            style={{ width: `${(task.currentStepNum / task.totalSteps) * 100}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-800">
                          <span className="text-slate-400">Step {task.currentStepNum} of {task.totalSteps}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTaskId(taskId);
                              setActiveTab('chat');
                            }}
                            className="text-emerald-400 font-bold hover:underline flex items-center space-x-1"
                          >
                            <span>Open in Chat</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- 6. SETTINGS ---------------- */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn text-xs">
              <h2 className="text-xl font-bold text-white">{t.settingsTitle}</h2>

              {/* Database Indicator */}
              <div className="glass-panel p-6 rounded-3xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Database Engine</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                    MongoDB Atlas (Live)
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Your project chats and steps are saved to MongoDB Atlas in the cloud.
                </p>
              </div>

              {/* Gemini API Key */}
              <div className="glass-panel p-6 rounded-3xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-200">{t.apiKeyLabel}</label>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono">Vision AI</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {t.apiKeyHelper}
                </p>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem('guider_api_key', e.target.value);
                  }}
                  className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              {/* Toggles */}
              <div className="glass-panel p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-200">{t.safetyToggle}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Show cautionary alerts before high-risk physical steps</div>
                  </div>
                  <button
                    onClick={() => setSafetyEnabled(!safetyEnabled)}
                    className={`w-12 h-6 rounded-full transition relative ${safetyEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${safetyEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <div>
                    <div className="font-bold text-slate-200">{t.audioToggle}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Enable audio cues on step transitions</div>
                  </div>
                  <button
                    onClick={() => setAudioFeedback(!audioFeedback)}
                    className={`w-12 h-6 rounded-full transition relative ${audioFeedback ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${audioFeedback ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 7. PROFILE ---------------- */}
          {activeTab === 'profile' && (
            <div className="max-w-xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn text-xs">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 text-4xl flex items-center justify-center mx-auto shadow-glow-emerald font-bold">
                  🚀
                </div>
                <h2 className="text-lg font-bold text-white">Student Maker</h2>
                <p className="text-xs text-emerald-400 font-semibold">8th Grade Innovator & Creator</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-5 rounded-3xl text-center">
                  <div className="text-2xl font-black text-emerald-400">{tasks.filter(t => t.status === 'Completed').length}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Completed Projects</div>
                </div>
                <div className="glass-panel p-5 rounded-3xl text-center">
                  <div className="text-2xl font-black text-teal-300">{tasks.filter(t => t.status === 'Active').length}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Active Projects</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ===================== MOBILE BOTTOM BAR ===================== */}
        <div className="md:hidden glass-nav px-4 py-2.5 flex justify-around items-center z-20 shrink-0">
          {[
            { id: 'home', label: 'Home', icon: Layers },
            { id: 'chat', label: 'Chat', icon: Compass },
            { id: 'new_task', label: 'New', icon: Plus, isFab: true },
            { id: 'tasks_list', label: 'Projects', icon: ListTodo },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
          ].map(item => {
            const Icon = item.icon;
            if (item.isFab) {
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center text-lg font-black shadow-glow-emerald -mt-5 active:scale-95 transition"
                >
                  <Icon className="w-5 h-5 stroke-[3]" />
                </button>
              );
            }
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center space-y-0.5 ${isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </main>

      {/* ===================== CAMERA MODAL ===================== */}
      {cameraModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-6 animate-fadeIn">
          <div className="w-full max-w-lg flex justify-between items-center text-white">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live Camera Viewfinder</span>
            <button
              onClick={() => {
                stopCameraStream();
                setCameraModal(false);
              }}
              className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          <div className="w-full max-w-lg h-[65vh] bg-slate-900 rounded-3xl overflow-hidden relative border border-slate-800 flex items-center justify-center">
            <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover" />
            <div className="absolute inset-8 border-2 border-dashed border-emerald-400/40 rounded-3xl pointer-events-none flex items-center justify-center">
              <span className="text-xs text-emerald-300 bg-slate-950/80 px-3 py-1.5 rounded-full backdrop-blur">
                Frame your work piece here
              </span>
            </div>
          </div>

          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white ring-4 ring-emerald-500/40 flex items-center justify-center shadow-2xl active:scale-90 transition mb-4"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500" />
          </button>
        </div>
      )}

      {/* ===================== WHY MODAL ===================== */}
      {whyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-700">
            <div className="flex items-center space-x-2 text-emerald-400">
              <HelpCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">Why This Step?</h3>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 leading-relaxed">
              {whyModal.why}
            </p>
            <button
              onClick={() => setWhyModal(null)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* ===================== IMAGE PREVIEW MODAL ===================== */}
      {imagePreviewModal && (
        <div 
          onClick={() => setImagePreviewModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
            <img src={imagePreviewModal} className="w-full h-full object-contain" alt="Expanded view" />
            <button
              onClick={() => setImagePreviewModal(null)}
              className="absolute top-4 right-4 bg-slate-950/80 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ===================== CUSTOM CONFIRMATION MODAL ===================== */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-700">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${confirmModal.isDestructive ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                {confirmModal.icon === 'trash' ? (
                  <Trash2 className="w-5 h-5 text-red-400" />
                ) : (
                  <Eraser className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">{confirmModal.title}</h3>
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex space-x-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-3 font-bold text-xs rounded-xl transition shadow-lg ${
                  confirmModal.isDestructive
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
