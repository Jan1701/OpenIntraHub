/**
 * ImageModule Component
 * Displays an image with optional caption and link
 */
function ImageModule({ config = {} }) {
    const {
        src,
        alt = '',
        width = 'auto',
        height = 'auto',
        objectFit = 'cover',
        link,
        caption
    } = config;

    if (!src) {
        return (
            <div className="card bg-gray-50 border-gray-200 text-center p-8">
                <p className="text-gray-500">No image selected</p>
            </div>
        );
    }

    const objectFitClasses = {
        cover: 'object-cover',
        contain: 'object-contain',
        fill: 'object-fill',
        none: 'object-none'
    };

    const imageElement = (
        <img
            src={src}
            alt={alt}
            className={`${objectFitClasses[objectFit]} rounded-lg`}
            style={{
                width: width !== 'auto' ? width : '100%',
                height: height !== 'auto' ? height : 'auto'
            }}
        />
    );

    return (
        <figure className="my-4">
            {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer">
                    {imageElement}
                </a>
            ) : (
                imageElement
            )}
            {caption && (
                <figcaption className="text-sm text-gray-600 text-center mt-2">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
}

export default ImageModule;
