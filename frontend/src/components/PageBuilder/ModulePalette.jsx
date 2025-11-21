import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';

function ModulePalette({ modules }) {
  const { t } = useTranslation();

  return (
    <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">{t('pageBuilder.modules')}</h2>

        {Object.entries(modules).map(([category, categoryModules]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
              {category}
            </h3>
            <div className="space-y-2">
              {categoryModules.map((module) => (
                <DraggableModule key={module.id} module={module} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraggableModule({ module }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `module-${module.id}`,
    data: { type: 'module', moduleId: module.id, module }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`card p-3 cursor-move hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center">
        <GripVertical className="w-4 h-4 text-gray-400 mr-2" />
        <div>
          <div className="font-medium text-sm">{module.name}</div>
          <div className="text-xs text-gray-500">{module.description}</div>
        </div>
      </div>
    </div>
  );
}

export default ModulePalette;
