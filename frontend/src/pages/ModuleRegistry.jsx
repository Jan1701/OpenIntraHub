import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { modulesApi } from '../services/api';

function ModuleRegistry() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const response = await modulesApi.list();
      setModules(response.data.data);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{t('pageBuilder.modules')}</h1>

      <div className="grid grid-cols-3 gap-4">
        {modules.map((module) => (
          <div key={module.id} className="card">
            <h3 className="font-semibold mb-2">{module.name}</h3>
            <p className="text-sm text-gray-600 mb-3">{module.description}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="px-2 py-1 bg-gray-100 rounded">{module.type}</span>
              <span className="text-gray-500">v{module.version}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModuleRegistry;
