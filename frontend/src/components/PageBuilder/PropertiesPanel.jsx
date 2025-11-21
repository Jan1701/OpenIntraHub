import { useTranslation } from 'react-i18next';

function PropertiesPanel({ element, onUpdate }) {
  const { t } = useTranslation();

  if (!element) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <p className="text-gray-500 text-center">
          Select an element to edit properties
        </p>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">{t('pageBuilder.settings')}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="input"
              value={element.name || ''}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>

          {element.styles && (
            <div>
              <label className="block text-sm font-medium mb-1">Background Color</label>
              <input
                type="color"
                className="w-full h-10 rounded border border-gray-300"
                value={element.styles.background || '#ffffff'}
                onChange={(e) => onUpdate({
                  styles: { ...element.styles, background: e.target.value }
                })}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Padding</label>
            <select
              className="input"
              value={element.styles?.padding || 'medium'}
              onChange={(e) => onUpdate({
                styles: { ...element.styles, padding: e.target.value }
              })}
            >
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PropertiesPanel;
