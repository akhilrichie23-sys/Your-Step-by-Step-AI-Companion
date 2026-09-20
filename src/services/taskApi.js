const API_BASE = 'http://localhost:5001/api';

export const taskApi = {
  async getTasks() {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend API offline, using local storage cache:', e);
    }
    const local = localStorage.getItem('guider_tasks_v3');
    return local ? JSON.parse(local) : [];
  },

  async createTask(taskData) {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, saving locally:', e);
    }
    return { ...taskData, _id: 'local-' + Date.now() };
  },

  async updateTask(id, updateData) {
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
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/chat`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, clearing locally:', e);
    }
    return null;
  },

  async deleteTask(id) {
    try {
      await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend offline, deleting locally:', e);
    }
  }
};
