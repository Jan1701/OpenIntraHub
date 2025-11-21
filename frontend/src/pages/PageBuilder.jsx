import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Eye, ArrowLeft, Plus } from 'lucide-react';
import { pagesApi, sectionsApi, modulesApi, pageModulesApi } from '../services/api';
import ModulePalette from '../components/PageBuilder/ModulePalette';
import Canvas from '../components/PageBuilder/Canvas';
import PropertiesPanel from '../components/PageBuilder/PropertiesPanel';

function PageBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [page, setPage] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load page data
  useEffect(() => {
    if (id) {
      loadPage();
    } else {
      // New page
      setPage({
        title: 'New Page',
        slug: '',
        template: 'default',
        status: 'draft',
        sections: []
      });
    }
    loadModules();
  }, [id]);

  const loadPage = async () => {
    try {
      setLoading(true);
      const response = await pagesApi.get(id);
      setPage(response.data.data);
    } catch (error) {
      console.error('Error loading page:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const response = await modulesApi.getByCategory();
      setModules(response.data.data);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      if (id) {
        await pagesApi.update(id, page);
      } else {
        const response = await pagesApi.create(page);
        navigate(`/pages/${response.data.data.id}/edit`);
      }
      alert('Page saved successfully!');
    } catch (error) {
      console.error('Error saving page:', error);
      alert('Error saving page');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = async () => {
    try {
      if (!page.id) {
        alert('Please save the page first');
        return;
      }

      const response = await sectionsApi.create(page.id, {
        name: `Section ${(page.sections?.length || 0) + 1}`,
        section_type: 'container',
        position: page.sections?.length || 0
      });

      setPage({
        ...page,
        sections: [...(page.sections || []), response.data.data]
      });
    } catch (error) {
      console.error('Error adding section:', error);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    // Handle dropping module from palette to section
    if (active.data.current?.type === 'module' && over.data.current?.type === 'section') {
      try {
        const moduleId = active.data.current.moduleId;
        const sectionId = over.id;

        const response = await pageModulesApi.create(sectionId, {
          page_id: page.id,
          module_id: moduleId,
          position: 0,
          config: {}
        });

        // Update page state
        const updatedSections = page.sections.map(section => {
          if (section.id === sectionId) {
            return {
              ...section,
              modules: [...(section.modules || []), response.data.data]
            };
          }
          return section;
        });

        setPage({ ...page, sections: updatedSections });
      } catch (error) {
        console.error('Error adding module:', error);
      }
    }

    setActiveId(null);
  };

  if (loading && !page) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/pages')}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{page?.title || 'New Page'}</h1>
        </div>

        <div className="flex items-center space-x-3">
          <button className="btn btn-secondary">
            <Eye className="w-4 h-4 mr-2" />
            {t('pageBuilder.preview')}
          </button>
          <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {t('pageBuilder.save')}
          </button>
        </div>
      </div>

      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Module Palette */}
          <ModulePalette modules={modules} />

          {/* Main Canvas */}
          <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
            <div className="max-w-6xl mx-auto">
              {page?.sections?.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">{t('pageBuilder.dragModule')}</p>
                  <button onClick={handleAddSection} className="btn btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('pageBuilder.addSection')}
                  </button>
                </div>
              ) : (
                <Canvas
                  sections={page?.sections || []}
                  onSelectElement={setSelectedElement}
                  selectedElement={selectedElement}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Properties */}
          <PropertiesPanel
            element={selectedElement}
            onUpdate={(updates) => {
              // Handle property updates
              console.log('Property updates:', updates);
            }}
          />
        </div>

        <DragOverlay>
          {activeId ? <div className="card p-4 shadow-lg">Dragging...</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default PageBuilder;
