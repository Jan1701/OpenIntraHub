const ldap = require('ldapjs');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('LDAP');

class LDAPAuth {
    constructor() {
        this.enabled = process.env.LDAP_URL ? true : false;
        this.config = {
            url: process.env.LDAP_URL || 'ldap://localhost:389',
            bindDN: process.env.LDAP_BIND_DN || '',
            bindPassword: process.env.LDAP_BIND_PASSWORD || '',
            searchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=example,dc=com',
            searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})'
        };
    }

    async authenticate(username, password) {
        if (!this.enabled) {
            logger.debug('LDAP nicht konfiguriert, überspringe LDAP-Auth');
            return null;
        }

        return new Promise((resolve, reject) => {
            const client = ldap.createClient({
                url: this.config.url,
                timeout: 5000,
                connectTimeout: 10000
            });

            // Fehlerbehandlung
            client.on('error', (err) => {
                logger.error('LDAP Client-Fehler', { error: err.message });
                client.unbind();
                reject(new Error('LDAP-Verbindungsfehler'));
            });

            // Schritt 1: Bind mit Admin-Account
            client.bind(this.config.bindDN, this.config.bindPassword, (bindErr) => {
                if (bindErr) {
                    logger.error('LDAP Bind-Fehler', { error: bindErr.message });
                    client.unbind();
                    return reject(new Error('LDAP-Authentifizierung fehlgeschlagen'));
                }

                // Schritt 2: Suche nach User
                const searchFilter = this.config.searchFilter.replace('{{username}}', username);
                const searchOptions = {
                    filter: searchFilter,
                    scope: 'sub',
                    attributes: ['dn', 'cn', 'mail', 'displayName', 'memberOf']
                };

                client.search(this.config.searchBase, searchOptions, (searchErr, searchRes) => {
                    if (searchErr) {
                        logger.error('LDAP Such-Fehler', { error: searchErr.message });
                        client.unbind();
                        return reject(new Error('LDAP-Suche fehlgeschlagen'));
                    }

                    let userDN = null;
                    let userData = null;

                    searchRes.on('searchEntry', (entry) => {
                        userDN = entry.objectName;
                        userData = {
                            dn: entry.objectName,
                            cn: entry.object.cn,
                            mail: entry.object.mail,
                            displayName: entry.object.displayName,
                            memberOf: entry.object.memberOf
                        };
                    });

                    searchRes.on('error', (err) => {
                        logger.error('LDAP Such-Stream-Fehler', { error: err.message });
                        client.unbind();
                        reject(new Error('LDAP-Suche fehlgeschlagen'));
                    });

                    searchRes.on('end', (result) => {
                        if (result.status !== 0 || !userDN) {
                            logger.debug('LDAP User nicht gefunden', { username });
                            client.unbind();
                            return resolve(null);
                        }

                        // Schritt 3: Authentifiziere mit User-Credentials
                        const userClient = ldap.createClient({
                            url: this.config.url,
                            timeout: 5000
                        });

                        userClient.bind(userDN, password, (userBindErr) => {
                            userClient.unbind();
                            client.unbind();

                            if (userBindErr) {
                                logger.debug('LDAP User-Authentifizierung fehlgeschlagen', { username });
                                return resolve(null);
                            }

                            logger.info('LDAP Authentifizierung erfolgreich', { username });
                            resolve({
                                username: username,
                                name: userData.displayName || userData.cn,
                                email: userData.mail,
                                ldapDN: userData.dn,
                                groups: Array.isArray(userData.memberOf)
                                    ? userData.memberOf
                                    : (userData.memberOf ? [userData.memberOf] : [])
                            });
                        });
                    });
                });
            });
        });
    }

    // Hilfsfunktion: Rolle aus LDAP-Gruppen ableiten
    getRoleFromGroups(groups) {
        if (!groups || groups.length === 0) {
            return 'user';
        }

        // Beispiel-Mapping (anpassbar)
        const adminGroups = ['cn=admins', 'cn=administrators'];
        const moderatorGroups = ['cn=moderators'];

        for (const group of groups) {
            const groupLower = group.toLowerCase();
            if (adminGroups.some(ag => groupLower.includes(ag))) {
                return 'admin';
            }
            if (moderatorGroups.some(mg => groupLower.includes(mg))) {
                return 'moderator';
            }
        }

        return 'user';
    }
}

// Singleton-Instanz
const ldapAuth = new LDAPAuth();

module.exports = ldapAuth;
