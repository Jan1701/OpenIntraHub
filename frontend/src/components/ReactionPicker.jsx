import React, { useState, useRef, useEffect } from 'react';

const REACTIONS = [
    { type: 'like', emoji: '👍', label: 'Like' },
    { type: 'love', emoji: '❤️', label: 'Love' },
    { type: 'celebrate', emoji: '🎉', label: 'Feiern' },
    { type: 'insightful', emoji: '💡', label: 'Einsichtsvoll' },
    { type: 'support', emoji: '🤝', label: 'Unterstützung' },
    { type: 'funny', emoji: '😄', label: 'Lustig' }
];

function ReactionPicker({ onReact, count = 0, myReaction = null }) {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
            }
        };

        if (showPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPicker]);

    const handleReactionClick = (reactionType) => {
        onReact(reactionType);
        setShowPicker(false);
    };

    return (
        <div className="relative" ref={pickerRef}>
            {/* Reaction Button */}
            <button
                onClick={() => setShowPicker(!showPicker)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition ${
                    myReaction
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
                {myReaction ? (
                    <span className="text-lg">
                        {REACTIONS.find(r => r.type === myReaction)?.emoji || '👍'}
                    </span>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                )}
                {count > 0 && (
                    <span className="text-sm font-medium">{count}</span>
                )}
            </button>

            {/* Reaction Picker Popup */}
            {showPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex items-center space-x-1 z-50">
                    {REACTIONS.map(reaction => (
                        <button
                            key={reaction.type}
                            onClick={() => handleReactionClick(reaction.type)}
                            className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-gray-100 rounded-lg transition transform hover:scale-125"
                            title={reaction.label}
                        >
                            {reaction.emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ReactionPicker;
