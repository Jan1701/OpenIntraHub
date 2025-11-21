/**
 * HeadingModule Component
 * Displays headings (H1-H6)
 */
function HeadingModule({ config = {} }) {
    const {
        text = 'Heading',
        level = 2,
        textAlign = 'left'
    } = config;

    const textAlignClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    };

    const HeadingTag = `h${level}`;

    const headingSizeClasses = {
        1: 'text-4xl md:text-5xl font-bold',
        2: 'text-3xl md:text-4xl font-bold',
        3: 'text-2xl md:text-3xl font-semibold',
        4: 'text-xl md:text-2xl font-semibold',
        5: 'text-lg md:text-xl font-medium',
        6: 'text-base md:text-lg font-medium'
    };

    return (
        <HeadingTag
            className={`${headingSizeClasses[level]} ${textAlignClasses[textAlign]} mb-4`}
        >
            {text}
        </HeadingTag>
    );
}

export default HeadingModule;
