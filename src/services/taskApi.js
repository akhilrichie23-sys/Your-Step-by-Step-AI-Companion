const API_BASE = 'http://localhost:5001/api';
const STORAGE_KEY = 'guider_tasks_v3';

function getLocalTasks() {
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error("Error saving tasks locally:", e);
  }
}

export const taskApi = {
  async getTasks() {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          saveLocalTasks(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('Backend API offline, using local storage cache:', e);
    }
    return getLocalTasks();
  },

  async createTask(taskData) {
    let created = { ...taskData, _id: 'local-' + Date.now(), id: 'local-' + Date.now() };
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        created = await res.json();
      }
    } catch (e) {
      console.warn('Backend offline, saving locally:', e);
    }
    
    const current = getLocalTasks();
    const updated = [created, ...current.filter(t => (t._id !== created._id && t.id !== created._id))];
    saveLocalTasks(updated);
    return created;
  },

  async updateTask(id, updateData) {
    const current = getLocalTasks();
    const updated = current.map(t => (t._id === id || t.id === id) ? { ...t, ...updateData } : t);
    saveLocalTasks(updated);

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, updating locally:', e);
    }
    return updateData;
  },

  async clearChat(id) {
    const current = getLocalTasks();
    const updated = current.map(t => (t._id === id || t.id === id) ? {
      ...t,
      history: [],
      currentStepNum: 1,
      completedSteps: 0,
      remainingSteps: t.totalSteps || 5,
      status: 'Active'
    } : t);
    saveLocalTasks(updated);

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/chat`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, cleared locally:', e);
    }
    return null;
  },

  async deleteTask(id) {
    const current = getLocalTasks();
    const updated = current.filter(t => (t._id !== id && t.id !== id));
    saveLocalTasks(updated);

    try {
      await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend offline, deleted locally:', e);
    }
  }
};
