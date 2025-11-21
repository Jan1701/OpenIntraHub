/**
 * TextModule Component
 * Displays rich text content
 */
function TextModule({ config = {} }) {
    const {
        content = '<p>Your text here...</p>',
        fontSize = 'medium',
        textAlign = 'left'
    } = config;

    const fontSizeClasses = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg',
        xlarge: 'text-xl'
    };

    const textAlignClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify'
    };

    return (
        <div
            className={`prose max-w-none ${fontSizeClasses[fontSize]} ${textAlignClasses[textAlign]}`}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}

export default TextModule;
