// =====================================================
// LDAP Service - Enhanced with User Caching & AD Support
// =====================================================

const ldap = require('ldapjs');
const pool = require('./db');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('LDAP');

class LDAPService {
    constructor() {
        this.enabled = process.env.LDAP_URL ? true : false;
        this.config = {
            url: process.env.LDAP_URL || 'ldap://localhost:389',
            bindDN: process.env.LDAP_BIND_DN || '',
            bindPassword: process.env.LDAP_BIND_PASSWORD || '',
            searchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=example,dc=com',
            searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
            groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || 'ou=groups,dc=example,dc=com',
            // Active Directory specific
            isActiveDirectory: process.env.LDAP_IS_AD === 'true',
            adDomain: process.env.LDAP_AD_DOMAIN || ''
        };

        logger.info('LDAP Service initialized', {
            enabled: this.enabled,
            url: this.config.url,
            isAD: this.config.isActiveDirectory
        });
    }

    /**
     * Authenticate user via LDAP and cache in database
     */
    async authenticate(username, password) {
        if (!this.enabled) {
            logger.debug('LDAP not configured, skipping LDAP auth');
            return null;
        }

        try {
            // First try to authenticate
            const ldapUser = await this._authenticateUser(username, password);
            if (!ldapUser) {
                return null;
            }

            // Cache/update user in database
            const dbUser = await this._syncUserToDatabase(ldapUser);

            logger.info('LDAP authentication successful', {
                username,
                userId: dbUser.id,
                role: dbUser.role
            });

            return dbUser;
        } catch (error) {
            logger.error('LDAP authentication failed', {
                error: error.message,
                username
            });
            throw error;
        }
    }

    /**
     * Authenticate user against LDAP server
     * @private
     */
    async _authenticateUser(username, password) {
        return new Promise((resolve, reject) => {
            const client = ldap.createClient({
                url: this.config.url,
                timeout: 5000,
                connectTimeout: 10000
            });

            client.on('error', (err) => {
                logger.error('LDAP client error', { error: err.message });
                client.unbind();
                reject(new Error('LDAP connection error'));
            });

            // Step 1: Bind with admin account
            client.bind(this.config.bindDN, this.config.bindPassword, (bindErr) => {
                if (bindErr) {
                    logger.error('LDAP bind error', { error: bindErr.message });
                    client.unbind();
                    return reject(new Error('LDAP authentication failed'));
                }

                // Step 2: Search for user
                const searchFilter = this._buildSearchFilter(username);
                const searchOptions = {
                    filter: searchFilter,
                    scope: 'sub',
                    attributes: this._getSearchAttributes()
                };

                client.search(this.config.searchBase, searchOptions, (searchErr, searchRes) => {
                    if (searchErr) {
                        logger.error('LDAP search error', { error: searchErr.message });
                        client.unbind();
                        return reject(new Error('LDAP search failed'));
                    }

                    let userDN = null;
                    let userData = null;

                    searchRes.on('searchEntry', (entry) => {
                        userDN = entry.objectName;
                        userData = this._extractUserData(entry);
                    });

                    searchRes.on('error', (err) => {
                        logger.error('LDAP search stream error', { error: err.message });
                        client.unbind();
                        reject(new Error('LDAP search failed'));
                    });

                    searchRes.on('end', (result) => {
                        if (result.status !== 0 || !userDN) {
                            logger.debug('LDAP user not found', { username });
                            client.unbind();
                            return resolve(null);
                        }

                        // Step 3: Authenticate with user credentials
                        const userClient = ldap.createClient({
                            url: this.config.url,
                            timeout: 5000
                        });

                        userClient.bind(userDN, password, (userBindErr) => {
                            userClient.unbind();
                            client.unbind();

                            if (userBindErr) {
                                logger.debug('LDAP user authentication failed', { username });
                                return resolve(null);
                            }

                            resolve(userData);
                        });
                    });
                });
            });
        });
    }

    /**
     * Build search filter supporting multiple formats
     * @private
     */
    _buildSearchFilter(username) {
        let filter = this.config.searchFilter.replace('{{username}}', username);

        // If Active Directory, support multiple login formats
        if (this.config.isActiveDirectory) {
            // Support: username, email@domain, DOMAIN\username, UPN
            filter = `(|(sAMAccountName=${username})(userPrincipalName=${username})(mail=${username})${this.config.searchFilter.replace('{{username}}', username)})`;
        }

        return filter;
    }

    /**
     * Get attributes to retrieve from LDAP
     * @private
     */
    _getSearchAttributes() {
        const baseAttrs = ['dn', 'cn', 'mail', 'displayName', 'memberOf'];

        if (this.config.isActiveDirectory) {
            return [...baseAttrs, 'objectGUID', 'sAMAccountName', 'userPrincipalName', 'primaryGroupID'];
        }

        return baseAttrs;
    }

    /**
     * Extract user data from LDAP entry
     * @private
     */
    _extractUserData(entry) {
        const obj = entry.object;

        const userData = {
            dn: entry.objectName,
            username: obj.uid || obj.sAMAccountName || obj.cn,
            name: obj.displayName || obj.cn,
            email: obj.mail,
            groups: this._extractGroups(obj.memberOf)
        };

        // Active Directory specific fields
        if (this.config.isActiveDirectory) {
            userData.guid = obj.objectGUID;
            userData.samAccountName = obj.sAMAccountName;
            userData.userPrincipalName = obj.userPrincipalName;
            userData.primaryGroupID = obj.primaryGroupID;
        }

        return userData;
    }

    /**
     * Extract and normalize group DNs
     * @private
     */
    _extractGroups(memberOf) {
        if (!memberOf) return [];
        if (Array.isArray(memberOf)) return memberOf;
        return [memberOf];
    }

    /**
     * Sync LDAP user to database (create or update)
     * @private
     */
    async _syncUserToDatabase(ldapUser) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Determine role from groups
            const role = await this._getRoleFromGroups(client, ldapUser.groups);

            // Check if username needs to be sanitized
            const username = ldapUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

            // Upsert user
            const result = await client.query(`
                INSERT INTO users (
                    username,
                    name,
                    email,
                    role,
                    auth_method,
                    ldap_dn,
                    ldap_guid,
                    ldap_sam_account_name,
                    ldap_user_principal_name,
                    ldap_groups,
                    ldap_last_sync_at,
                    ldap_source_server,
                    last_login_at,
                    is_active
                ) VALUES ($1, $2, $3, $4, 'ldap', $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, CURRENT_TIMESTAMP, true)
                ON CONFLICT (username) DO UPDATE SET
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    ldap_dn = EXCLUDED.ldap_dn,
                    ldap_guid = EXCLUDED.ldap_guid,
                    ldap_sam_account_name = EXCLUDED.ldap_sam_account_name,
                    ldap_user_principal_name = EXCLUDED.ldap_user_principal_name,
                    ldap_groups = EXCLUDED.ldap_groups,
                    ldap_last_sync_at = CURRENT_TIMESTAMP,
                    last_login_at = CURRENT_TIMESTAMP,
                    is_active = true,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, username, name, email, role, auth_method
            `, [
                username,
                ldapUser.name,
                ldapUser.email || `${username}@${this.config.adDomain || 'local'}`,
                role,
                ldapUser.dn,
                ldapUser.guid || null,
                ldapUser.samAccountName || null,
                ldapUser.userPrincipalName || null,
                JSON.stringify(ldapUser.groups),
                this.config.url
            ]);

            await client.query('COMMIT');

            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to sync LDAP user to database', {
                error: error.message,
                username: ldapUser.username
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get application role from LDAP groups using database mappings
     * @private
     */
    async _getRoleFromGroups(client, groups) {
        if (!groups || groups.length === 0) {
            return 'user';
        }

        try {
            // Use database function to get role
            const result = await client.query(
                'SELECT get_role_from_ldap_groups($1) as role',
                [groups]
            );

            return result.rows[0]?.role || 'user';
        } catch (error) {
            logger.warn('Failed to get role from LDAP groups, using default', { error: error.message });
            return 'user';
        }
    }

    /**
     * Test LDAP connection
     */
    async testConnection() {
        if (!this.enabled) {
            throw new Error('LDAP is not configured');
        }

        return new Promise((resolve, reject) => {
            const client = ldap.createClient({
                url: this.config.url,
                timeout: 5000,
                connectTimeout: 10000
            });

            client.on('error', (err) => {
                client.unbind();
                reject(new Error(`Connection failed: ${err.message}`));
            });

            client.bind(this.config.bindDN, this.config.bindPassword, (bindErr) => {
                if (bindErr) {
                    client.unbind();
                    return reject(new Error(`Bind failed: ${bindErr.message}`));
                }

                // Test search
                client.search(this.config.searchBase, {
                    filter: '(objectClass=*)',
                    scope: 'base',
                    attributes: ['dn']
                }, (searchErr, searchRes) => {
                    if (searchErr) {
                        client.unbind();
                        return reject(new Error(`Search failed: ${searchErr.message}`));
                    }

                    searchRes.on('error', (err) => {
                        client.unbind();
                        reject(new Error(`Search error: ${err.message}`));
                    });

                    searchRes.on('end', (result) => {
                        client.unbind();
                        if (result.status === 0) {
                            resolve({
                                success: true,
                                message: 'LDAP connection successful',
                                server: this.config.url,
                                searchBase: this.config.searchBase,
                                isActiveDirectory: this.config.isActiveDirectory
                            });
                        } else {
                            reject(new Error(`Search returned status: ${result.status}`));
                        }
                    });
                });
            });
        });
    }

    /**
     * Search for users in LDAP
     */
    async searchUsers(searchTerm = '*', limit = 100) {
        if (!this.enabled) {
            throw new Error('LDAP is not configured');
        }

        return new Promise((resolve, reject) => {
            const client = ldap.createClient({
                url: this.config.url,
                timeout: 10000,
                connectTimeout: 10000
            });

            client.on('error', (err) => {
                client.unbind();
                reject(new Error(`Connection error: ${err.message}`));
            });

            client.bind(this.config.bindDN, this.config.bindPassword, (bindErr) => {
                if (bindErr) {
                    client.unbind();
                    return reject(new Error(`Bind failed: ${bindErr.message}`));
                }

                // Build search filter
                let filter;
                if (searchTerm === '*') {
                    filter = '(objectClass=person)';
                } else {
                    if (this.config.isActiveDirectory) {
                        filter = `(|(cn=*${searchTerm}*)(sAMAccountName=*${searchTerm}*)(mail=*${searchTerm}*)(displayName=*${searchTerm}*))`;
                    } else {
                        filter = `(|(cn=*${searchTerm}*)(uid=*${searchTerm}*)(mail=*${searchTerm}*))`;
                    }
                }

                const searchOptions = {
                    filter,
                    scope: 'sub',
                    attributes: this._getSearchAttributes(),
                    sizeLimit: limit
                };

                const users = [];

                client.search(this.config.searchBase, searchOptions, (searchErr, searchRes) => {
                    if (searchErr) {
                        client.unbind();
                        return reject(new Error(`Search failed: ${searchErr.message}`));
                    }

                    searchRes.on('searchEntry', (entry) => {
                        users.push(this._extractUserData(entry));
                    });

                    searchRes.on('error', (err) => {
                        client.unbind();
                        reject(new Error(`Search error: ${err.message}`));
                    });

                    searchRes.on('end', () => {
                        client.unbind();
                        resolve(users);
                    });
                });
            });
        });
    }

    /**
     * Get LDAP configuration (without sensitive data)
     */
    getConfig() {
        return {
            enabled: this.enabled,
            url: this.config.url,
            searchBase: this.config.searchBase,
            isActiveDirectory: this.config.isActiveDirectory,
            domain: this.config.adDomain
        };
    }
}

// Singleton instance
const ldapService = new LDAPService();

module.exports = ldapService;
