// Project Management - Kanban Board with Drag & Drop
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon, GripVertical, Calendar, User, Tag,
  X, ChevronDown, AlertCircle, CheckCircle2
} from 'lucide-react';
import api from '../../services/api';

function ProjectKanban() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [project, setProject] = useState(null);
  const [boards, setBoards] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Modal states
  const [taskModal, setTaskModal] = useState({ open: false, task: null, columnId: null });
  const [formData, setFormData] = useState({
    title: '', description: '', priority: 'medium',
    due_date: '', assignee_id: ''
  });
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projRes, boardsRes, tasksRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/boards`),
        api.get(`/projects/${projectId}/tasks`)
      ]);
      setProject(projRes.data.data);
      setBoards(boardsRes.data.data);
      setTasks(tasksRes.data.data || []);
      setMembers(projRes.data.data?.members || []);
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-50');
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e, targetColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.column_id === targetColumnId) return;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === draggedTask.id ? { ...t, column_id: targetColumnId } : t
    ));

    try {
      await api.put(`/tasks/${draggedTask.id}/move`, {
        column_id: targetColumnId,
        position: 0
      });
    } catch (error) {
      console.error('Move failed:', error);
      loadData(); // Revert on error
    }
  };

  // Task modal handlers
  const openNewTaskModal = (columnId) => {
    setFormData({ title: '', description: '', priority: 'medium', due_date: '', assignee_id: '' });
    setTaskModal({ open: true, task: null, columnId });
  };

  const openEditTaskModal = (task) => {
    setFormData({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assignee_id: task.assignee_id || ''
    });
    setTaskModal({ open: true, task, columnId: task.column_id });
  };

  const closeModal = () => {
    setTaskModal({ open: false, task: null, columnId: null });
  };

  const saveTask = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);

    try {
      if (taskModal.task) {
        // Update existing task
        await api.put(`/tasks/${taskModal.task.id}`, formData);
      } else {
        // Create new task
        await api.post('/tasks', {
          ...formData,
          project_id: projectId,
          column_id: taskModal.columnId
        });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm(t('projects:task.deleteConfirm'))) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      closeModal();
      loadData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getPriorityStyles = (priority) => {
    const styles = {
      low: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
      medium: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
      critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
    };
    return styles[priority] || styles.medium;
  };

  const getColumnColor = (index) => {
    const colors = ['border-t-gray-400', 'border-t-blue-400', 'border-t-yellow-400', 'border-t-green-400', 'border-t-purple-400'];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const columns = boards[0]?.columns || [];

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{project?.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {tasks.length} {t('projects:task.tasks')}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map((column, idx) => {
            const columnTasks = tasks.filter(t => t.column_id === column.id);
            const isDropTarget = dragOverColumn === column.id;

            return (
              <div
                key={column.id}
                className={`flex-shrink-0 w-80 flex flex-col bg-gray-50 rounded-lg border-t-4 ${getColumnColor(idx)} ${
                  isDropTarget ? 'ring-2 ring-blue-400 bg-blue-50' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-4 border-b bg-white rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">{column.name}</h3>
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openNewTaskModal(column.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-md transition"
                    title={t('projects:task.new')}
                  >
                    <PlusIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {columnTasks.map((task) => {
                    const priorityStyle = getPriorityStyles(task.priority);

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openEditTaskModal(task)}
                        className="bg-white rounded-lg shadow-sm border hover:shadow-md transition cursor-grab active:cursor-grabbing group"
                      >
                        <div className="p-3">
                          {/* Task Header */}
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-mono text-gray-400">{task.task_key}</span>
                            <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition" />
                          </div>

                          {/* Title */}
                          <h4 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2">
                            {task.title}
                          </h4>

                          {/* Meta */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* Priority Badge */}
                              <span className={`text-xs px-2 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
                                {task.priority}
                              </span>

                              {/* Due Date */}
                              {task.due_date && (
                                <span className="flex items-center text-xs text-gray-500">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {new Date(task.due_date).toLocaleDateString('de-DE')}
                                </span>
                              )}
                            </div>

                            {/* Assignee Avatar */}
                            {task.assignee_name && (
                              <div
                                className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium"
                                title={task.assignee_name}
                              >
                                {task.assignee_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty State */}
                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">{t('projects:task.empty')}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Modal */}
      {taskModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {taskModal.task ? t('projects:task.edit') : t('projects:task.new')}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects:task.title')} *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('projects:task.titlePlaceholder')}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects:task.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder={t('projects:task.descriptionPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('projects:task.priority')}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">{t('projects:priority.low')}</option>
                    <option value="medium">{t('projects:priority.medium')}</option>
                    <option value="high">{t('projects:priority.high')}</option>
                    <option value="critical">{t('projects:priority.critical')}</option>
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('projects:task.dueDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects:task.assignee')}
                </label>
                <select
                  value={formData.assignee_id}
                  onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('projects:task.unassigned')}</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <div>
                {taskModal.task && (
                  <button
                    onClick={() => deleteTask(taskModal.task.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    {t('common:general.delete')}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  {t('common:general.cancel')}
                </button>
                <button
                  onClick={saveTask}
                  disabled={saving || !formData.title.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {saving ? '...' : t('common:general.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectKanban;
