# GUIDER — Your Step-by-Step AI Companion

> **"Show me what you're doing. I'll guide you through the next step."**
> 
> 🌐 **Live Demo:** [https://guider-ai-companion.onrender.com](https://guider-ai-companion.onrender.com)

---

## 🌟 Architecture & Full-Stack Integration

GUIDER is built as a complete **production-grade web application** connected to **MongoDB Atlas** with real-time cloud data synchronization.

### 📦 Tech Stack & Infrastructure
- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide React + Canvas Confetti
- **Database**: MongoDB Atlas Cloud (`cluster0.1krxnul.mongodb.net`)
- **Backend API**: Node.js + Express + Mongoose (`server.js`)
- **Testing**: Vitest + React Testing Library + JSDOM (`npm test`)
- **Multimodal Engine**: Web Speech API for voice recognition + Camera Viewfinder & photo attachment + Gemini AI / Adaptive Engine

---

## 🚀 Key Features

1. **New Conversation & Multi-Project Management**:
   - Create brand-new projects or tasks from scratch at any time (**`New Project`** / **`New Conversation`**).
   - Dedicated **`Clear Chat`** button to wipe out message history and reset to Step 1 without deleting the project metadata.
   - Delete entire projects permanently from the dashboard with instant cloud syncing.
2. **Strict Single-Step Delivery**:
   - **Current Status**: What GUIDER sees and verifies.
   - **Next Step Hero Box**: One concise, atomic action.
   - **Why This Matters**: Scientific and craft reasoning for the step.
   - **Safety System**: Real-time hazard warnings.
   - **Verification Prompt**: Clear instructions on what to snap next.
3. **Check My Work**:
   - Camera & gallery photo evaluator with diagnostic assessments (*Good*, *Needs Improvement*, *Clarification Needed*).
4. **Cloud Persistence with MongoDB Atlas**:
   - Real-time save of conversation histories, step progression, and project data.
5. **Multilingual Support**: English, Spanish, and French runtime language switching.

---

## 🛠️ How to Run

```bash
# 1. Start MongoDB Backend Server (Port 5001)
node server.js

# 2. Start Vite Frontend (Port 5173 / 5174)
npm run dev

# 3. Run Automated Test Suite
npm test

# 4. Build Production Bundle
npm run build
```
