import PostsModule from './PostsModule';
import TextModule from './TextModule';
import HeadingModule from './HeadingModule';
import ImageModule from './ImageModule';

/**
 * ModuleRenderer Component
 * Dynamically renders modules based on their component type
 * Used in Page Builder to render page content
 */
function ModuleRenderer({ module }) {
    const { component, config = {} } = module;

    // Module component mapping
    const moduleComponents = {
        PostsModule,
        TextModule,
        HeadingModule,
        ImageModule,
        // Add more modules as they are created
    };

    const ModuleComponent = moduleComponents[component];

    if (!ModuleComponent) {
        return (
            <div className="card bg-yellow-50 border-yellow-200">
                <div className="text-yellow-700">
                    <strong>Module not found:</strong> {component}
                </div>
                <div className="text-sm text-yellow-600 mt-1">
                    This module is not implemented yet or the component name is incorrect.
                </div>
            </div>
        );
    }

    return (
        <div className="module-wrapper" data-module={component}>
            <ModuleComponent config={config} />
        </div>
    );
}

export default ModuleRenderer;
