/**
 * Seed Script: Page Builder Modules
 * Erstellt initiale System-Module für den Page Builder
 *
 * @author Jan Günther <jg@linxpress.de>
 */

const database = require('../../core/database');
const logger = require('../../core/logger');

const SYSTEM_MODULES = [
    // ==============================================
    // LAYOUT MODULES
    // ==============================================
    {
        name: 'Header',
        type: 'layout',
        component: 'HeaderModule',
        icon: 'layout-navbar',
        category: 'layout',
        description: 'Seiten-Header mit Logo und Navigation',
        settings_schema: {
            type: 'object',
            properties: {
                logo: { type: 'string', title: 'Logo URL' },
                logoHeight: { type: 'number', title: 'Logo Höhe (px)', default: 50 },
                sticky: { type: 'boolean', title: 'Fixed Header', default: false },
                transparent: { type: 'boolean', title: 'Transparenter Hintergrund', default: false },
                menuId: { type: 'integer', title: 'Navigationsmenü ID' }
            }
        },
        default_config: {
            sticky: false,
            transparent: false,
            logoHeight: 50
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Footer',
        type: 'layout',
        component: 'FooterModule',
        icon: 'layout-footer',
        category: 'layout',
        description: 'Seiten-Footer mit Copyright und Links',
        settings_schema: {
            type: 'object',
            properties: {
                columns: { type: 'integer', title: 'Anzahl Spalten', default: 3 },
                showSocial: { type: 'boolean', title: 'Social Media Icons', default: true },
                copyrightText: { type: 'string', title: 'Copyright Text' }
            }
        },
        default_config: {
            columns: 3,
            showSocial: true
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Container',
        type: 'layout',
        component: 'ContainerModule',
        icon: 'layout-columns',
        category: 'layout',
        description: 'Container für andere Module',
        settings_schema: {
            type: 'object',
            properties: {
                maxWidth: {
                    type: 'string',
                    title: 'Max. Breite',
                    enum: ['full', 'boxed', 'narrow', 'wide'],
                    default: 'boxed'
                },
                padding: { type: 'string', title: 'Innenabstand', default: 'medium' }
            }
        },
        default_config: {
            maxWidth: 'boxed',
            padding: 'medium'
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Columns',
        type: 'layout',
        component: 'ColumnsModule',
        icon: 'layout-columns',
        category: 'layout',
        description: 'Spalten-Layout',
        settings_schema: {
            type: 'object',
            properties: {
                columns: {
                    type: 'integer',
                    title: 'Anzahl Spalten',
                    minimum: 1,
                    maximum: 12,
                    default: 2
                },
                gap: { type: 'string', title: 'Spaltenabstand', default: 'medium' },
                stackOnMobile: { type: 'boolean', title: 'Mobile stapeln', default: true }
            }
        },
        default_config: {
            columns: 2,
            gap: 'medium',
            stackOnMobile: true
        },
        is_system: true,
        required_permission: null
    },

    // ==============================================
    // CONTENT MODULES
    // ==============================================
    {
        name: 'Posts',
        type: 'content',
        component: 'PostsModule',
        icon: 'file-text',
        category: 'content',
        description: 'Beiträge/Blog-Posts anzeigen',
        settings_schema: {
            type: 'object',
            properties: {
                layout: {
                    type: 'string',
                    title: 'Layout',
                    enum: ['grid', 'list', 'masonry', 'carousel'],
                    default: 'grid'
                },
                columns: { type: 'integer', title: 'Spalten', default: 3 },
                postsPerPage: { type: 'integer', title: 'Beiträge pro Seite', default: 12 },
                showExcerpt: { type: 'boolean', title: 'Auszug anzeigen', default: true },
                showAuthor: { type: 'boolean', title: 'Autor anzeigen', default: true },
                showDate: { type: 'boolean', title: 'Datum anzeigen', default: true },
                showThumbnail: { type: 'boolean', title: 'Vorschaubild', default: true },
                category: { type: 'string', title: 'Kategorie Filter' }
            }
        },
        default_config: {
            layout: 'grid',
            columns: 3,
            postsPerPage: 12,
            showExcerpt: true,
            showAuthor: true,
            showDate: true,
            showThumbnail: true
        },
        is_system: true,
        required_permission: 'content.view'
    },
    {
        name: 'Text',
        type: 'content',
        component: 'TextModule',
        icon: 'text',
        category: 'content',
        description: 'Rich Text / WYSIWYG Editor',
        settings_schema: {
            type: 'object',
            properties: {
                content: { type: 'string', title: 'Inhalt', format: 'html' },
                fontSize: { type: 'string', title: 'Schriftgröße', default: 'medium' },
                textAlign: {
                    type: 'string',
                    title: 'Ausrichtung',
                    enum: ['left', 'center', 'right', 'justify'],
                    default: 'left'
                }
            }
        },
        default_config: {
            content: '<p>Ihr Text hier...</p>',
            fontSize: 'medium',
            textAlign: 'left'
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Heading',
        type: 'content',
        component: 'HeadingModule',
        icon: 'heading',
        category: 'content',
        description: 'Überschrift',
        settings_schema: {
            type: 'object',
            properties: {
                text: { type: 'string', title: 'Text' },
                level: {
                    type: 'integer',
                    title: 'Überschrift-Level',
                    enum: [1, 2, 3, 4, 5, 6],
                    default: 2
                },
                textAlign: {
                    type: 'string',
                    enum: ['left', 'center', 'right'],
                    default: 'left'
                }
            }
        },
        default_config: {
            level: 2,
            textAlign: 'left'
        },
        is_system: true,
        required_permission: null
    },

    // ==============================================
    // MEDIA MODULES
    // ==============================================
    {
        name: 'Image',
        type: 'content',
        component: 'ImageModule',
        icon: 'image',
        category: 'media',
        description: 'Einzelnes Bild',
        settings_schema: {
            type: 'object',
            properties: {
                src: { type: 'string', title: 'Bild URL', format: 'uri' },
                alt: { type: 'string', title: 'Alt Text' },
                width: { type: 'string', title: 'Breite' },
                height: { type: 'string', title: 'Höhe' },
                objectFit: {
                    type: 'string',
                    title: 'Skalierung',
                    enum: ['cover', 'contain', 'fill', 'none'],
                    default: 'cover'
                },
                link: { type: 'string', title: 'Link URL', format: 'uri' },
                caption: { type: 'string', title: 'Bildunterschrift' }
            }
        },
        default_config: {
            objectFit: 'cover'
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Gallery',
        type: 'content',
        component: 'GalleryModule',
        icon: 'images',
        category: 'media',
        description: 'Bildergalerie',
        settings_schema: {
            type: 'object',
            properties: {
                images: {
                    type: 'array',
                    title: 'Bilder',
                    items: {
                        type: 'object',
                        properties: {
                            src: { type: 'string' },
                            alt: { type: 'string' },
                            caption: { type: 'string' }
                        }
                    }
                },
                columns: { type: 'integer', title: 'Spalten', default: 3 },
                gap: { type: 'string', title: 'Abstand', default: 'medium' },
                lightbox: { type: 'boolean', title: 'Lightbox', default: true }
            }
        },
        default_config: {
            columns: 3,
            gap: 'medium',
            lightbox: true,
            images: []
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Video',
        type: 'content',
        component: 'VideoModule',
        icon: 'video',
        category: 'media',
        description: 'Video einbetten',
        settings_schema: {
            type: 'object',
            properties: {
                source: {
                    type: 'string',
                    title: 'Quelle',
                    enum: ['upload', 'youtube', 'vimeo', 'url'],
                    default: 'youtube'
                },
                url: { type: 'string', title: 'Video URL' },
                autoplay: { type: 'boolean', title: 'Autoplay', default: false },
                loop: { type: 'boolean', title: 'Loop', default: false },
                controls: { type: 'boolean', title: 'Controls anzeigen', default: true }
            }
        },
        default_config: {
            source: 'youtube',
            autoplay: false,
            loop: false,
            controls: true
        },
        is_system: true,
        required_permission: null
    },

    // ==============================================
    // NAVIGATION MODULES
    // ==============================================
    {
        name: 'Navigation',
        type: 'navigation',
        component: 'NavigationModule',
        icon: 'menu',
        category: 'navigation',
        description: 'Navigationsmenü',
        settings_schema: {
            type: 'object',
            properties: {
                menuId: { type: 'integer', title: 'Menü ID' },
                orientation: {
                    type: 'string',
                    enum: ['horizontal', 'vertical'],
                    default: 'horizontal'
                },
                showIcons: { type: 'boolean', title: 'Icons anzeigen', default: false }
            }
        },
        default_config: {
            orientation: 'horizontal',
            showIcons: false
        },
        is_system: true,
        required_permission: null
    },

    // ==============================================
    // WIDGET MODULES
    // ==============================================
    {
        name: 'Hero',
        type: 'widget',
        component: 'HeroModule',
        icon: 'layout-banner',
        category: 'widget',
        description: 'Hero-Section mit Hintergrundbild',
        settings_schema: {
            type: 'object',
            properties: {
                backgroundImage: { type: 'string', title: 'Hintergrundbild URL' },
                height: { type: 'string', title: 'Höhe', default: '500px' },
                overlay: { type: 'boolean', title: 'Dunkles Overlay', default: true },
                overlayOpacity: { type: 'number', title: 'Overlay Opacity', minimum: 0, maximum: 1, default: 0.5 },
                title: { type: 'string', title: 'Titel' },
                subtitle: { type: 'string', title: 'Untertitel' },
                buttonText: { type: 'string', title: 'Button Text' },
                buttonLink: { type: 'string', title: 'Button Link' },
                textAlign: {
                    type: 'string',
                    enum: ['left', 'center', 'right'],
                    default: 'center'
                }
            }
        },
        default_config: {
            height: '500px',
            overlay: true,
            overlayOpacity: 0.5,
            textAlign: 'center'
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Spacer',
        type: 'widget',
        component: 'SpacerModule',
        icon: 'space',
        category: 'widget',
        description: 'Abstandshalter',
        settings_schema: {
            type: 'object',
            properties: {
                height: { type: 'string', title: 'Höhe', default: '50px' }
            }
        },
        default_config: {
            height: '50px'
        },
        is_system: true,
        required_permission: null
    },
    {
        name: 'Divider',
        type: 'widget',
        component: 'DividerModule',
        icon: 'minus',
        category: 'widget',
        description: 'Trennlinie',
        settings_schema: {
            type: 'object',
            properties: {
                style: {
                    type: 'string',
                    enum: ['solid', 'dashed', 'dotted', 'double'],
                    default: 'solid'
                },
                width: { type: 'string', title: 'Breite', default: '100%' },
                thickness: { type: 'string', title: 'Dicke', default: '1px' },
                color: { type: 'string', title: 'Farbe', default: '#cccccc' }
            }
        },
        default_config: {
            style: 'solid',
            width: '100%',
            thickness: '1px',
            color: '#cccccc'
        },
        is_system: true,
        required_permission: null
    }
];

async function seedModules() {
    try {
        logger.info('Seeding Page Builder Modules...');

        await database.connect();

        for (const module of SYSTEM_MODULES) {
            // Prüfen ob Modul bereits existiert
            const existing = await database.query(
                'SELECT id FROM module_registry WHERE name = $1',
                [module.name]
            );

            if (existing.rows.length > 0) {
                logger.info(`Module "${module.name}" already exists, skipping...`);
                continue;
            }

            // Modul einfügen
            await database.query(
                `INSERT INTO module_registry
                (name, type, component, icon, category, description, settings_schema, default_config, is_system, required_permission, version, author)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    module.name,
                    module.type,
                    module.component,
                    module.icon,
                    module.category,
                    module.description,
                    JSON.stringify(module.settings_schema),
                    JSON.stringify(module.default_config),
                    module.is_system,
                    module.required_permission,
                    module.version || '1.0.0',
                    module.author || 'OpenIntraHub'
                ]
            );

            logger.info(`✓ Created module: ${module.name}`);
        }

        logger.info(`✓ Successfully seeded ${SYSTEM_MODULES.length} modules`);

        await database.close();
        process.exit(0);

    } catch (error) {
        logger.error('Error seeding modules', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// Wenn direkt ausgeführt
if (require.main === module) {
    seedModules();
}

module.exports = { seedModules, SYSTEM_MODULES };
