// =====================================================
// Chat Page - Main Chat Interface
// =====================================================

import React, { useState } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

function Chat() {
    const [selectedConversationId, setSelectedConversationId] = useState(null);

    return (
        <div className="h-screen flex">
            {/* Chat List Sidebar */}
            <div className="w-80 flex-shrink-0">
                <ChatList
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={setSelectedConversationId}
                />
            </div>

            {/* Chat Window */}
            <div className="flex-1">
                <ChatWindow conversationId={selectedConversationId} />
            </div>
        </div>
    );
}

export default Chat;
