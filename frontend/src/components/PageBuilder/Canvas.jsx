import { useDroppable } from '@dnd-kit/core';

function Canvas({ sections, onSelectElement, selectedElement }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Section
          key={section.id}
          section={section}
          isSelected={selectedElement?.id === section.id}
          onSelect={() => onSelectElement(section)}
        />
      ))}
    </div>
  );
}

function Section({ section, isSelected, onSelect }) {
  const { setNodeRef, isOver } = useDroppable({
    id: section.id,
    data: { type: 'section', section }
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`card min-h-[200px] p-4 transition-all ${
        isSelected ? 'ring-2 ring-primary-500' : ''
      } ${isOver ? 'bg-primary-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{section.name}</h3>
        <span className="text-xs text-gray-500">
          {section.modules?.length || 0} modules
        </span>
      </div>

      {section.modules && section.modules.length > 0 ? (
        <div className="space-y-2">
          {section.modules.map((mod) => (
            <div key={mod.id} className="card p-3 bg-gray-50">
              <div className="font-medium text-sm">{mod.module_name || 'Module'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg text-gray-400">
          Drop modules here
        </div>
      )}
    </div>
  );
}

export default Canvas;
