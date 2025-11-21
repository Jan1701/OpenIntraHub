// =====================================================
// useUserStatus Hook - User Status Management
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook for managing user status
 * @param {Array} userIds - Optional array of user IDs to track
 * @returns {Object} Status management functions and state
 */
export function useUserStatus(userIds = []) {
    const [statuses, setStatuses] = useState({});
    const [myStatus, setMyStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    // Load current user's status
    const loadMyStatus = useCallback(async () => {
        try {
            const response = await api.get('/status/me');
            if (response.data.success) {
                setMyStatus(response.data.status);
            }
        } catch (error) {
            console.error('Error loading my status:', error);
        }
    }, []);

    // Load statuses for multiple users
    const loadStatuses = useCallback(async (ids) => {
        if (!ids || ids.length === 0) return;

        try {
            const response = await api.post('/status/bulk', {
                userIds: ids
            });

            if (response.data.success) {
                setStatuses(prev => ({
                    ...prev,
                    ...response.data.statuses
                }));
            }
        } catch (error) {
            console.error('Error loading statuses:', error);
        }
    }, []);

    // Load status for single user
    const loadUserStatus = useCallback(async (userId) => {
        try {
            const response = await api.get(`/status/${userId}`);
            if (response.data.success) {
                setStatuses(prev => ({
                    ...prev,
                    [userId]: response.data.status
                }));
            }
        } catch (error) {
            console.error('Error loading user status:', error);
        }
    }, []);

    // Update current user's status
    const updateMyStatus = useCallback(async (status, statusMessage = null) => {
        try {
            setLoading(true);
            const response = await api.put('/status/me', {
                status,
                status_message: statusMessage
            });

            if (response.data.success) {
                setMyStatus(response.data.status);
                return { success: true };
            }
        } catch (error) {
            console.error('Error updating status:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, []);

    // Set Out of Office
    const setOutOfOffice = useCallback(async (oofData) => {
        try {
            setLoading(true);
            const response = await api.post('/status/me/oof', oofData);

            if (response.data.success) {
                setMyStatus(response.data.status);
                return { success: true };
            }
        } catch (error) {
            console.error('Error setting OOF:', error);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, []);

    // Send heartbeat to update last active
    const sendHeartbeat = useCallback(async () => {
        try {
            await api.post('/status/heartbeat');
        } catch (error) {
            // Silent fail for heartbeat
        }
    }, []);

    // Get status for specific user
    const getUserStatus = useCallback((userId) => {
        return statuses[userId] || null;
    }, [statuses]);

    // Load initial data
    useEffect(() => {
        loadMyStatus();
    }, [loadMyStatus]);

    // Load user statuses when userIds change
    useEffect(() => {
        if (userIds.length > 0) {
            loadStatuses(userIds);
        }
    }, [userIds, loadStatuses]);

    // Setup heartbeat (every 60 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            sendHeartbeat();
        }, 60000); // 60 seconds

        // Send initial heartbeat
        sendHeartbeat();

        return () => clearInterval(interval);
    }, [sendHeartbeat]);

    return {
        myStatus,
        statuses,
        loading,
        loadMyStatus,
        loadStatuses,
        loadUserStatus,
        updateMyStatus,
        setOutOfOffice,
        getUserStatus,
        sendHeartbeat
    };
}

/**
 * Hook for single user status
 */
export function useSingleUserStatus(userId) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const loadStatus = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/status/${userId}`);
                if (response.data.success) {
                    setStatus(response.data.status);
                }
            } catch (error) {
                console.error('Error loading user status:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStatus();
    }, [userId]);

    return { status, loading };
}
