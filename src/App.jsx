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
  Database,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Save,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES } from './data/initialTasks';
import { TRANSLATIONS, CATEGORY_TRANSLATIONS, SUPPORTED_LANGUAGES } from './data/translations';
import { analyzeWithGuider } from './services/aiService';
import { taskApi } from './services/taskApi';

export default function App() {
  // Navigation: 'home' | 'chat' | 'check_work' | 'new_task' | 'tasks_list' | 'task_details' | 'profile' | 'settings'
  const [activeTab, setActiveTab] = useState('home');
  const [lang, setLang] = useState(() => localStorage.getItem('guider_lang') || 'en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const getCategoryLabel = (cat) => {
    return CATEGORY_TRANSLATIONS[cat]?.[lang] || cat;
  };

  const getStatusLabel = (status) => {
    if (status === 'Completed') return t.statusCompleted;
    return t.statusActive;
  };

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);
  const [dbConnected, setDbConnected] = useState(true);

  // Settings State & Enhanced Security
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('guider_api_key') || '');
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [studentSafetyMode, setStudentSafetyMode] = useState(() => localStorage.getItem('guider_student_safety') === 'true');
  const [privacyFilter, setPrivacyFilter] = useState(() => localStorage.getItem('guider_privacy_filter') !== 'false');
  const [hazardCheckpoints, setHazardCheckpoints] = useState(() => localStorage.getItem('guider_hazard_checkpoints') === 'true');

  // Profile State
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('guider_profile_v2');
    return saved ? JSON.parse(saved) : {
      name: 'Student Maker',
      title: '8th Grade Innovator & Creator',
      bio: 'Exploring maker crafts, electronics, papercraft, and DIY recipes step-by-step with GUIDER AI.',
      skill: 'Intermediate',
      avatar: '🚀'
    };
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(profile);
  const [profileToast, setProfileToast] = useState(false);

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

  // Load tasks on startup from MongoDB or LocalStorage
  const isInitialized = useRef(false);

  useEffect(() => {
    taskApi.getTasks().then(data => {
      const loaded = data || [];
      setTasks(loaded);
      isInitialized.current = true;
      if (loaded.length > 0) {
        const firstId = loaded[0]._id || loaded[0].id;
        setActiveTaskId(firstId);
      }
    });
  }, []);

  // Sync tasks to LocalStorage backup whenever tasks change
  useEffect(() => {
    if (isInitialized.current) {
      localStorage.setItem('guider_tasks_v3', JSON.stringify(tasks));
    }
  }, [tasks]);

  // Scroll to bottom on new chat messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tasks, activeTab, isProcessing]);

  const activeTask = tasks.find(item => (item._id === activeTaskId || item.id === activeTaskId)) || tasks[0] || null;

  const handleLanguageChange = (code) => {
    setLang(code);
    localStorage.setItem('guider_lang', code);
  };

  // --- Web Speech API ---
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t.speechErrorAlert);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    const langMap = {
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      pt: 'pt-BR',
      it: 'it-IT',
      ja: 'ja-JP',
      hi: 'hi-IN',
      en: 'en-US'
    };
    recognition.lang = langMap[lang] || 'en-US';
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

  const sanitizeImage = (dataUrl) => {
    if (!privacyFilter) return Promise.resolve(dataUrl);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 640;
        canvas.height = img.naturalHeight || img.height || 480;
        const ctx = canvas.getContext('2d');
        // Render raw pixels to clean metadata / EXIF tags
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const capturePhoto = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const raw = canvas.toDataURL('image/jpeg', 0.85);
      const clean = await sanitizeImage(raw);
      setSelectedImage(clean);
      stopCameraStream();
    } else {
      setSelectedImage("https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80");
    }
    setCameraModal(false);
  };

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const cleaned = await sanitizeImage(reader.result);
        setSelectedImage(cleaned);
      };
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
        title: textToSend.slice(0, 30) || t.newConversationDefault,
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

    setTasks(prev => prev.map(item => (item._id === targetId || item.id === targetId) ? updatedTask : item));
    setInputText('');
    setSelectedImage(null);
    setIsProcessing(true);

    try {
      const aiResponse = await analyzeWithGuider({
        prompt: textToSend,
        image: imgToSend,
        task: updatedTask,
        apiKey,
        safetyEnabled,
        studentSafetyMode
      });

      if (aiResponse.isCompleted) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      }

      // Audio feedback chime on step completion / transition
      if (audioFeedback && !aiResponse.isChat && typeof window !== 'undefined' && window.AudioContext) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        } catch (e) {
          // Audio cue fallback
        }
      }

      const isChatMsg = Boolean(aiResponse.isChat);
      const aiMessage = {
        sender: 'guider',
        isChat: isChatMsg,
        text: aiResponse.text || '',
        status: aiResponse.status || '',
        step: aiResponse.step || '',
        why: aiResponse.why || '',
        safety: aiResponse.safety || null,
        promptForPhoto: aiResponse.promptForPhoto || '',
        stepNumber: aiResponse.stepNumber || updatedTask.currentStepNum,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalizedTask = {
        ...updatedTask,
        currentStepNum: isChatMsg 
          ? updatedTask.currentStepNum 
          : (aiResponse.isCompleted ? updatedTask.totalSteps : Math.min(updatedTask.totalSteps, (aiResponse.stepNumber || updatedTask.currentStepNum + 1))),
        completedSteps: isChatMsg 
          ? updatedTask.completedSteps 
          : Math.min(updatedTask.totalSteps, updatedTask.completedSteps + 1),
        remainingSteps: isChatMsg 
          ? updatedTask.remainingSteps 
          : Math.max(0, updatedTask.totalSteps - (aiResponse.stepNumber || updatedTask.currentStepNum + 1)),
        status: isChatMsg ? updatedTask.status : (aiResponse.isCompleted ? 'Completed' : 'Active'),
        history: [...updatedHistory, aiMessage]
      };

      setTasks(prev => prev.map(item => (item._id === targetId || item.id === targetId) ? finalizedTask : item));
      
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
      goal: newTaskGoal.trim() || t.describeGoalDefault,
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
        text: `${taskPayload.title}.`,
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
      handleSendMessage(t.msgInitialPrompt);
    }, 200);
  };

  // --- Clear Current Chat Messages ---
  const handleClearCurrentChat = () => {
    if (!activeTask) return;
    setConfirmModal({
      title: t.clearChatTitle,
      message: t.clearChatMsg,
      confirmText: t.clearChatConfirm,
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

        setTasks(prev => prev.map(item => (item._id === targetId || item.id === targetId) ? resetTask : item));
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
      title: t.deleteTaskTitle,
      message: t.deleteTaskMsg,
      confirmText: t.deleteTaskConfirm,
      isDestructive: true,
      icon: "trash",
      onConfirm: async () => {
        const remaining = tasks.filter(item => (item._id !== id && item.id !== id));
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

  // --- Reset All Data (Danger Zone) ---
  const handleResetAllData = () => {
    setConfirmModal({
      title: t.resetAllDataConfirmTitle,
      message: t.resetAllDataConfirmMsg,
      confirmText: t.resetAllDataConfirmBtn,
      isDestructive: true,
      icon: "trash",
      onConfirm: async () => {
        localStorage.removeItem('guider_tasks_v3');
        setTasks([]);
        setActiveTaskId(null);
        setSelectedTaskForDetails(null);
        setActiveTab('home');
        setConfirmModal(null);
      }
    });
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'home': return t.tagline;
      case 'chat': return t.navChat;
      case 'new_task': return t.navNewChat;
      case 'tasks_list': return t.navProjects;
      case 'check_work': return t.checkWorkTitle;
      case 'settings': return t.settingsTitle;
      case 'profile': return t.profile;
      default: return t.tagline;
    }
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
                  <span className="text-base font-extrabold tracking-tight text-white">{t.appName}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
                  {t.aiCompanion}
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
              <span>{t.navDashboard}</span>
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
                <span>{t.navChat}</span>
              </div>
              {activeTask?.status === 'Active' && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                  {t.stepProgress} {activeTask.currentStepNum}
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
              <span>{t.navNewChat}</span>
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
                <span>{t.navProjects}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">{tasks.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'profile' 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <span className="text-sm leading-none">{profile.avatar || '🚀'}</span>
              <span className="truncate">{profile.name || t.profile}</span>
            </button>
          </nav>

          {/* Recent Conversations / Chats in Sidebar */}
          <div className="px-4 py-2 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
              <span>{t.recentChats}</span>
              <span className="text-slate-500 font-mono">{tasks.length}</span>
            </div>

            {tasks.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-850 text-center text-[11px] text-slate-500">
                {t.noChatsYet}
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
                        <span className="truncate font-medium">{task.title || t.newConversationDefault}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(taskId, e)}
                        title={t.deleteChat}
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
            <span>{t.dbConnected}</span>
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

          <div className="flex flex-col space-y-2 px-3.5 py-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.language}:</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {SUPPORTED_LANGUAGES.map(item => (
                <button
                  key={item.code}
                  onClick={() => handleLanguageChange(item.code)}
                  title={item.name}
                  className={`text-[10px] uppercase font-bold py-1 rounded transition text-center ${
                    lang === item.code ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
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
              <span className="font-bold text-sm text-white">{t.appName}</span>
            </div>

            <div className="hidden md:block">
              <h1 className="text-sm font-bold text-white">
                {getPageTitle()}
              </h1>
              <p className="text-[11px] text-slate-400">
                {activeTask ? `${t.currentProjectLabel} ${activeTask.title}` : t.readyFirstProject}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Mobile Language Selector */}
            <div className="flex md:hidden overflow-x-auto max-w-[140px] space-x-1 mr-1 py-1">
              {SUPPORTED_LANGUAGES.map(item => (
                <button
                  key={item.code}
                  onClick={() => handleLanguageChange(item.code)}
                  title={item.name}
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    lang === item.code ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 bg-slate-900/60'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeTab === 'chat' && activeTask && (
              <button
                onClick={handleClearCurrentChat}
                title={t.clearChat}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">{t.clearChat}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('new_task')}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t.newProject}</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 flex items-center space-x-2 text-xs font-bold transition border border-slate-700 shadow-sm"
              title={t.profile}
            >
              <span className="text-sm">{profile.avatar || '🚀'}</span>
              <span className="hidden sm:inline text-[11px] font-semibold text-slate-300 truncate max-w-[100px]">{profile.name}</span>
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
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold tracking-wider uppercase text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        {t.stepByStepBadge}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-400">{t.dbConnected}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                      {t.heroTitle}
                    </h2>
                    <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                      {t.heroSub}
                    </p>
                  </div>

                  {/* Personalized Maker Profile Widget */}
                  <div 
                    onClick={() => setActiveTab('profile')}
                    className="shrink-0 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer flex items-center space-x-3.5 group shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 text-2xl flex items-center justify-center font-bold shadow-glow-emerald group-hover:scale-105 transition">
                      {profile.avatar || '🚀'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition">{profile.name}</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">{profile.skill}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5">{profile.title}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Action Launchers */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                  {t.startAnAction}
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
                      {getCategoryLabel(activeTask.category)}
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
                          {t.stepProgress} {activeTask.currentStepNum} {t.ofSteps} {activeTask.totalSteps}
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
                        <span>{t.currentStage} <strong className="text-slate-200">{activeTask.currentStepTitle || t.activeGuidedPhase}</strong></span>
                      </div>
                      <span>{t.updated} {activeTask.updatedDate}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-8 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Compass className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{t.noActiveProject}</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {t.noActiveProjectDesc}
                  </p>
                  <button
                    onClick={() => setActiveTab('new_task')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                  >
                    {t.createFirstTask}
                  </button>
                </div>
              )}

              {/* All Recent Conversations & Projects */}
              {tasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {t.previousProjects} ({tasks.length})
                    </span>
                    <button onClick={() => setActiveTab('tasks_list')} className="text-xs text-emerald-400 hover:underline">
                      {t.viewAll}
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
                            <span className="text-[10px] font-bold text-emerald-400/90 uppercase">{getCategoryLabel(task.category)}</span>
                            <div className="flex items-center space-x-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${task.status === 'Completed' ? 'bg-teal-500/20 text-teal-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {getStatusLabel(task.status)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTask(taskId, e)}
                                title={t.deleteChat}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">{task.title}</h4>
                          <div className="text-[11px] text-slate-400 flex justify-between items-center pt-2 border-t border-slate-800">
                            <span>{task.completedSteps || 0}/{task.totalSteps || 5} {t.stepsWord}</span>
                            <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                              <span>{t.open}</span>
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
                    {t.stepProgress} {activeTask?.currentStepNum || 1} / {activeTask?.totalSteps || 5}
                  </span>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">{activeTask?.title || t.newConversationDefault}</h3>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{activeTask?.goal || t.describeGoalDefault}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClearCurrentChat}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition"
                  >
                    <Eraser className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.clear}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('check_work')}
                    className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center space-x-1 transition"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t.checkWork}</span>
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
                    <h3 className="text-base font-bold text-white">{t.startProjectPrompt}</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {t.startProjectPromptSub}
                    </p>
                  </div>
                )}

                {activeTask?.history?.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fadeIn`}>
                    {msg.sender === 'user' ? (
                      <div className="max-w-[85%] md:max-w-[70%] bg-[#15223f] text-slate-100 rounded-3xl rounded-tr-md p-4 border border-slate-700/80 shadow-md text-xs space-y-2">
                        <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[10px] pb-1 border-b border-slate-700/50">
                          <span>{profile.avatar || '🚀'}</span>
                          <span className="text-slate-200">{profile.name || 'You'}</span>
                          <span className="text-[9px] text-emerald-400/80 font-normal">({profile.skill})</span>
                        </div>
                        {msg.image && (
                          <div 
                            onClick={() => setImagePreviewModal(msg.image)}
                            className="rounded-2xl overflow-hidden border border-slate-600/80 shadow max-h-60 cursor-pointer group relative"
                          >
                            <img src={msg.image} className="w-full h-full object-cover group-hover:scale-105 transition" alt="User progress" />
                            <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur">
                              🔍 {t.expandImage}
                            </div>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <span className="text-[10px] text-slate-400 block text-right font-mono">{msg.timestamp}</span>
                      </div>
                    ) : (msg.isChat || (!msg.step && msg.text)) ? (
                      <div className="max-w-[85%] md:max-w-[70%] glass-panel rounded-3xl rounded-tl-md p-4 text-xs space-y-2 shadow-lg border border-slate-800">
                        <div className="flex items-center space-x-2 text-emerald-400 font-bold text-[11px]">
                          <Compass className="w-3.5 h-3.5 text-teal-400" />
                          <span>GUIDER</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.text || msg.status}</p>
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
                            onClick={() => handleSendMessage(t.msgDidIt, selectedImage)}
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
                            onClick={() => handleSendMessage(t.msgAskTroubleshoot)}
                            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                          >
                            💬 {t.askSomething}
                          </button>

                          <button
                            onClick={() => handleSendMessage(t.msgSkipStep)}
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
                    <span className="font-medium">{t.assessingSituation}</span>
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
                    title={t.startCamera}
                    className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center border border-slate-700 transition shrink-0"
                  >
                    <Camera className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={t.uploadPhoto}
                    className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 transition shrink-0"
                  >
                    <Upload className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    title={t.speak}
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
                      <span className="text-[10px] text-slate-500 mt-0.5">{t.useCameraDesc}</span>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 bg-slate-900 border border-dashed border-slate-700 hover:border-teal-500 rounded-3xl flex flex-col items-center justify-center text-slate-300 hover:text-teal-400 transition group"
                    >
                      <Upload className="w-8 h-8 mb-2 text-teal-400 group-hover:scale-110 transition" />
                      <span className="text-xs font-bold">{t.uploadPhoto}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{t.fromGalleryDesc}</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">{t.contextNoteLabel}</label>
                  <input
                    type="text"
                    placeholder={t.contextNotePlaceholder}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300">
                  <div className="font-bold">{t.goodStatus}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.goodStatusDesc}</div>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300">
                  <div className="font-bold">{t.improveStatus}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.improveStatusDesc}</div>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300">
                  <div className="font-bold">{t.unclearStatus}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.unclearStatusDesc}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveTab('chat');
                  handleSendMessage(t.msgVerifyWork, selectedImage);
                }}
                disabled={!selectedImage && !inputText}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-2xl shadow-glow-emerald transition"
              >
                {t.submitVerification}
              </button>
            </div>
          )}

          {/* ---------------- 4. CREATE NEW TASK / CONVERSATION ---------------- */}
          {activeTab === 'new_task' && (
            <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white">{t.newProjectTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t.newProjectSub}</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">{t.projectTitleLabel}</label>
                  <input
                    type="text"
                    placeholder={t.projectTitlePlaceholder}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">{t.categoryLabel}</label>
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
                        {getCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">{t.goalLabel}</label>
                  <textarea
                    rows={3}
                    placeholder={t.goalPlaceholder}
                    value={newTaskGoal}
                    onChange={(e) => setNewTaskGoal(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">{t.startingPhotoLabel}</label>
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
                        <span className="text-[11px] font-bold">{t.uploadMaterials}</span>
                      </button>
                      <button
                        type="button"
                        onClick={openLiveCamera}
                        className="p-4 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 transition"
                      >
                        <Camera className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-bold">{t.snapCamera}</span>
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
                {t.launchProject}
              </button>
            </div>
          )}

          {/* ---------------- 5. ALL TASKS LIST ---------------- */}
          {activeTab === 'tasks_list' && (
            <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">{t.projectsHistoryTitle}</h2>
                  <p className="text-xs text-slate-400">{t.projectsHistorySub}</p>
                </div>
                <button
                  onClick={() => setActiveTab('new_task')}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.newProject}</span>
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="glass-panel p-10 rounded-3xl text-center space-y-3">
                  <p className="text-slate-400 text-xs">{t.noProjectsYet}</p>
                  <button
                    onClick={() => setActiveTab('new_task')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                  >
                    {t.createProjectBtn}
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
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{getCategoryLabel(task.category)}</span>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${task.status === 'Completed' ? 'bg-teal-500/20 text-teal-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {getStatusLabel(task.status)}
                            </span>
                            <button
                              onClick={(e) => handleDeleteTask(taskId, e)}
                              title={t.deleteChat}
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
                          <span className="text-slate-400">{t.stepProgress} {task.currentStepNum} {t.ofSteps} {task.totalSteps}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTaskId(taskId);
                              setActiveTab('chat');
                            }}
                            className="text-emerald-400 font-bold hover:underline flex items-center space-x-1"
                          >
                            <span>{t.openInChat}</span>
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
                  <span className="font-bold text-slate-200">{t.dbEngine}</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                    {t.dbLive}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {t.dbEngineDesc}
                </p>
              </div>

              {/* Security & Workshop Safety Section */}
              <div className="glass-panel p-6 rounded-3xl space-y-4">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-bold">{t.securitySection}</span>
                </div>

                {/* Primary Safety Guardrails */}
                <div className="flex justify-between items-center pt-2">
                  <div>
                    <div className="font-bold text-slate-200">{t.safetyToggle}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.safetyToggleDesc}</div>
                  </div>
                  <button
                    onClick={() => setSafetyEnabled(!safetyEnabled)}
                    className={`w-12 h-6 rounded-full transition relative ${safetyEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${safetyEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Student & Minor Protection */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <div>
                    <div className="font-bold text-slate-200">{t.studentSafetyMode}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.studentSafetyDesc}</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !studentSafetyMode;
                      setStudentSafetyMode(next);
                      localStorage.setItem('guider_student_safety', String(next));
                    }}
                    className={`w-12 h-6 rounded-full transition relative ${studentSafetyMode ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${studentSafetyMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Photo Privacy Guard */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <div>
                    <div className="font-bold text-slate-200">{t.privacyFilter}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.privacyFilterDesc}</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !privacyFilter;
                      setPrivacyFilter(next);
                      localStorage.setItem('guider_privacy_filter', String(next));
                    }}
                    className={`w-12 h-6 rounded-full transition relative ${privacyFilter ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${privacyFilter ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Hazard Checkpoint Lock */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <div>
                    <div className="font-bold text-slate-200">{t.hazardAlerts}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.hazardAlertsDesc}</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !hazardCheckpoints;
                      setHazardCheckpoints(next);
                      localStorage.setItem('guider_hazard_checkpoints', String(next));
                    }}
                    className={`w-12 h-6 rounded-full transition relative ${hazardCheckpoints ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${hazardCheckpoints ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Audio Feedback */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <div>
                    <div className="font-bold text-slate-200">{t.audioToggle}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.audioToggleDesc}</div>
                  </div>
                  <button
                    onClick={() => setAudioFeedback(!audioFeedback)}
                    className={`w-12 h-6 rounded-full transition relative ${audioFeedback ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition ${audioFeedback ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
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
                  placeholder="Paste your Gemini API key (AQ... or AIza...)"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem('guider_api_key', e.target.value);
                  }}
                  className="w-full bg-[#080d1a] border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              {/* Danger Zone & Reset */}
              <div className="glass-panel p-6 rounded-3xl border border-red-500/30 space-y-3 bg-red-950/10">
                <div className="flex items-center space-x-2 text-red-400 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{t.dangerZone}</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {t.resetAllDataDesc}
                </p>
                <button
                  type="button"
                  onClick={handleResetAllData}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl font-bold text-xs transition flex items-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.resetAllData}</span>
                </button>
              </div>
            </div>
          )}

          {/* ---------------- 7. PROFILE ---------------- */}
          {activeTab === 'profile' && (
            <div className="max-w-xl mx-auto p-6 md:p-8 space-y-6 animate-fadeIn text-xs">
              {profileToast && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-2xl text-center font-bold animate-fadeIn flex items-center justify-center space-x-2">
                  <Check className="w-4 h-4" />
                  <span>{t.profileSavedToast}</span>
                </div>
              )}

              <div className="text-center space-y-3">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 text-5xl flex items-center justify-center mx-auto shadow-glow-emerald font-bold transform hover:scale-105 transition cursor-pointer">
                  {profile.avatar || '🚀'}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">{profile.name}</h2>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">{profile.title}</p>
                </div>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                  {profile.bio}
                </p>
                
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setTempProfile(profile);
                      setIsEditingProfile(!isEditingProfile);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isEditingProfile ? t.cancel : t.editProfile}</span>
                  </button>
                </div>
              </div>

              {/* Edit Form */}
              {isEditingProfile && (
                <div className="glass-panel p-6 rounded-3xl space-y-4 border border-emerald-500/30 animate-fadeIn">
                  <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-emerald-400" />
                    <span>{t.editProfile}</span>
                  </h3>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Choose Avatar</label>
                    <div className="flex flex-wrap gap-2">
                      {['🚀', '⚡', '🛠️', '🎨', '💡', '🌿', '🤖', '🔬', '🍰', '📐'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setTempProfile(prev => ({ ...prev, avatar: emoji }))}
                          className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${
                            tempProfile.avatar === emoji 
                              ? 'bg-emerald-500 text-slate-950 scale-110 shadow-glow-emerald' 
                              : 'bg-slate-800/80 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{t.profileNameLabel}</label>
                    <input
                      type="text"
                      value={tempProfile.name}
                      onChange={(e) => setTempProfile(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{t.profileTitleLabel}</label>
                    <input
                      type="text"
                      value={tempProfile.title}
                      onChange={(e) => setTempProfile(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{t.skillLevelLabel}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Beginner', label: t.skillBeginner },
                        { id: 'Intermediate', label: t.skillIntermediate },
                        { id: 'Advanced', label: t.skillExpert }
                      ].map(lvl => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setTempProfile(prev => ({ ...prev, skill: lvl.id }))}
                          className={`py-2 px-2 rounded-xl text-[10px] font-bold border transition text-center ${
                            tempProfile.skill === lvl.id 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5">{t.profileBioLabel}</label>
                    <textarea
                      rows={3}
                      value={tempProfile.bio}
                      onChange={(e) => setTempProfile(prev => ({ ...prev, bio: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition text-xs"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfile(tempProfile);
                        localStorage.setItem('guider_profile_v2', JSON.stringify(tempProfile));
                        setIsEditingProfile(false);
                        setProfileToast(true);
                        setTimeout(() => setProfileToast(false), 3000);
                      }}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold rounded-xl shadow-glow-emerald transition text-xs flex items-center justify-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{t.saveProfile}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-5 rounded-3xl text-center">
                  <div className="text-2xl font-black text-emerald-400">{tasks.filter(item => item.status === 'Completed').length}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">{t.completedProjects}</div>
                </div>
                <div className="glass-panel p-5 rounded-3xl text-center">
                  <div className="text-2xl font-black text-teal-300">{tasks.filter(item => item.status === 'Active').length}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">{t.activeProjects}</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ===================== MOBILE BOTTOM BAR ===================== */}
        <div className="md:hidden glass-nav px-4 py-2.5 flex justify-around items-center z-20 shrink-0">
          {[
            { id: 'home', label: t.tabHome, icon: Layers },
            { id: 'chat', label: t.tabChat, icon: Compass },
            { id: 'new_task', label: t.tabNew, icon: Plus, isFab: true },
            { id: 'tasks_list', label: t.tabProjects, icon: ListTodo },
            { id: 'settings', label: t.tabSettings, icon: SettingsIcon },
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
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{t.cameraViewfinderTitle}</span>
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
                {t.cameraFrameText}
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
              <h3 className="font-bold text-sm text-white">{t.whyModalTitle}</h3>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 leading-relaxed">
              {whyModal.why}
            </p>
            <button
              onClick={() => setWhyModal(null)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
            >
              {t.understood}
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
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">{t.confirmationRequired}</p>
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
                {t.cancel}
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
                {confirmModal.confirmText || t.understood}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
