const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'OpenIntraHub API',
            version: '0.1.0',
            description: 'Modulare Social-Intranet-Plattform API Dokumentation',
            contact: {
                name: 'OpenIntraHub Team'
            },
            license: {
                name: 'Apache 2.0',
                url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
            }
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3000}`,
                description: 'Development Server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT Authorization header using the Bearer scheme'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'User ID'
                        },
                        username: {
                            type: 'string',
                            description: 'Username'
                        },
                        name: {
                            type: 'string',
                            description: 'Display Name'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email Address'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'moderator', 'editor', 'user', 'guest'],
                            description: 'User Role'
                        }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['username', 'password'],
                    properties: {
                        username: {
                            type: 'string',
                            description: 'Username'
                        },
                        password: {
                            type: 'string',
                            format: 'password',
                            description: 'Password'
                        }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        token: {
                            type: 'string',
                            description: 'JWT Token'
                        },
                        user: {
                            $ref: '#/components/schemas/User'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message'
                        }
                    }
                }
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentifizierung erforderlich',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            }
                        }
                    }
                },
                ForbiddenError: {
                    description: 'Keine Berechtigung',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            }
                        }
                    }
                }
            }
        },
        security: []
    },
    apis: ['./core/app.js', './core/*.js', './modules/**/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
    swaggerUi,
    swaggerSpec
};
