// =====================================================
// User Status Badge - Global Status Indicator
// =====================================================

import React from 'react';

/**
 * Status types:
 * - available (green)
 * - away (yellow)
 * - busy (red)
 * - dnd (red with moon)
 * - offline (gray)
 * - oof (purple with calendar)
 */

const STATUS_CONFIG = {
    available: {
        color: 'bg-green-500',
        label: 'Verfügbar',
        icon: null
    },
    away: {
        color: 'bg-yellow-500',
        label: 'Abwesend',
        icon: null
    },
    busy: {
        color: 'bg-red-500',
        label: 'Beschäftigt',
        icon: null
    },
    dnd: {
        color: 'bg-red-600',
        label: 'Nicht stören',
        icon: '🌙'
    },
    offline: {
        color: 'bg-gray-400',
        label: 'Offline',
        icon: null
    },
    oof: {
        color: 'bg-purple-500',
        label: 'Abwesend',
        icon: '🏖️'
    }
};

function UserStatusBadge({ status, size = 'sm', showLabel = false, className = '' }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

    const sizeClasses = {
        xs: 'w-2 h-2',
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };

    const badgeSize = sizeClasses[size] || sizeClasses.sm;

    if (showLabel) {
        return (
            <div className={`inline-flex items-center gap-2 ${className}`}>
                <div className={`${badgeSize} ${config.color} rounded-full border-2 border-white flex items-center justify-center`}>
                    {config.icon && (
                        <span className="text-[8px]">{config.icon}</span>
                    )}
                </div>
                <span className="text-sm text-gray-700">{config.label}</span>
            </div>
        );
    }

    return (
        <div
            className={`${badgeSize} ${config.color} rounded-full border-2 border-white flex items-center justify-center ${className}`}
            title={config.label}
        >
            {config.icon && size !== 'xs' && size !== 'sm' && (
                <span className="text-[10px]">{config.icon}</span>
            )}
        </div>
    );
}

export default UserStatusBadge;
