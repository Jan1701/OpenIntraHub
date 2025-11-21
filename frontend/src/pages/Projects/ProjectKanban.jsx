// Project Management - Kanban Board MVP
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlusIcon, MoreVerticalIcon } from 'lucide-react';
import api from '../../services/api';

function ProjectKanban() {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const [project, setProject] = useState(null);
  const [boards, setBoards] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskModal, setNewTaskModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

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
      setTasks(tasksRes.data.data);
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', {
        project_id: projectId,
        title: newTaskTitle,
        column_id: selectedColumn,
        priority: 'medium'
      });
      setNewTaskModal(false);
      setNewTaskTitle('');
      loadData();
    } catch (error) {
      console.error('Create task failed:', error);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = { low: 'bg-gray-200', medium: 'bg-blue-200', high: 'bg-orange-200', critical: 'bg-red-200' };
    return colors[priority] || 'bg-gray-200';
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 h-screen overflow-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project?.name}</h1>
        <p className="text-gray-600">{project?.description}</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ height: 'calc(100vh - 200px)' }}>
        {boards[0]?.columns?.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{column.name}</h3>
              <button
                onClick={() => { setSelectedColumn(column.id); setNewTaskModal(true); }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {tasks.filter(t => t.column_id === column.id).map((task) => (
                <div key={task.id} className="bg-white p-3 rounded shadow-sm hover:shadow-md transition cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500">{task.task_key}</span>
                    <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <h4 className="font-medium text-sm mb-2">{task.title}</h4>
                  {task.assignee_name && (
                    <div className="flex items-center text-xs text-gray-600">
                      <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-2">
                        {task.assignee_name[0]}
                      </span>
                      {task.assignee_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {newTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">{t('projects:task.new')}</h2>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={t('projects:task.title')}
              className="w-full px-4 py-2 border rounded mb-4"
              onKeyPress={(e) => e.key === 'Enter' && createTask()}
            />
            <div className="flex gap-2">
              <button onClick={() => setNewTaskModal(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded">
                {t('common:general.cancel')}
              </button>
              <button onClick={createTask} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">
                {t('common:general.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectKanban;
