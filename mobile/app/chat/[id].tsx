import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import {
  Text,
  TextInput,
  IconButton,
  Avatar,
  Surface,
  ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { useAuthStore } from '@/stores/authStore';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  createdAt: string;
  attachments?: string[];
}

interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  participants: Array<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  }>;
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const user = useAuthStore((state) => state.user);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const loadConversation = async () => {
    try {
      const [convData, messagesData] = await Promise.all([
        chatApi.getConversations().then((convs: Conversation[]) =>
          convs.find((c: Conversation) => c.id === id)
        ),
        chatApi.getMessages(id!),
      ]);

      setConversation(convData || null);
      setMessages(messagesData.reverse());
      await chatApi.markAsRead(id!);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
    socketService.connect();
    socketService.joinConversation(id!);

    const unsubscribe = socketService.on('chat:message', (data: unknown) => {
      const messageData = data as { conversationId: string; message: Message };
      if (messageData.conversationId === id) {
        setMessages((prev) => [...prev, messageData.message]);
      }
    });

    return () => {
      unsubscribe();
      socketService.leaveConversation(id!);
    };
  }, [id]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMessage = await chatApi.sendMessage(id!, content);
      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  const getConversationTitle = (): string => {
    if (!conversation) return '';
    if (conversation.isGroup) return conversation.name;
    const other = conversation.participants.find((p) => p.id !== user?.id);
    return other?.firstName || other?.username || 'Unknown';
  };

  const formatMessageTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return t('chat.today', 'Today');
    if (isYesterday(date)) return t('chat.yesterday', 'Yesterday');
    return format(date, 'dd.MM.yyyy');
  };

  const shouldShowDateHeader = (index: number): boolean => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].createdAt);
    const prevDate = new Date(messages[index - 1].createdAt);
    return !isSameDay(currentDate, prevDate);
  };

  const isDark = colorScheme === 'dark';
  const isOwnMessage = (senderId: string) => senderId === user?.id;

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const own = isOwnMessage(item.senderId);

    return (
      <View>
        {shouldShowDateHeader(index) && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>
              {formatDateHeader(item.createdAt)}
            </Text>
          </View>
        )}

        <View style={[styles.messageRow, own && styles.messageRowOwn]}>
          {!own && conversation?.isGroup && (
            <Avatar.Text
              size={32}
              label={item.senderName?.[0] || '?'}
              style={styles.messageAvatar}
            />
          )}

          <Surface
            style={[
              styles.messageBubble,
              own ? styles.messageBubbleOwn : styles.messageBubbleOther,
            ]}
            elevation={1}
          >
            {!own && conversation?.isGroup && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            <Text style={[styles.messageText, own && styles.messageTextOwn]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, own && styles.messageTimeOwn]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </Surface>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: getConversationTitle(),
          headerBackTitle: t('nav.chat', 'Chat'),
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, isDark && styles.containerDark]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t('chat.noMessages', 'No messages yet')}
              </Text>
            </View>
          }
        />

        <Surface style={styles.inputContainer} elevation={2}>
          <TextInput
            mode="outlined"
            placeholder={t('chat.typeMessage', 'Type a message...')}
            value={inputText}
            onChangeText={setInputText}
            style={styles.input}
            multiline
            maxLength={2000}
            right={
              <TextInput.Icon
                icon="send"
                disabled={!inputText.trim() || sending}
                onPress={sendMessage}
              />
            }
          />
        </Surface>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  messagesList: {
    padding: 16,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#9CA3AF',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    marginRight: 8,
    backgroundColor: '#6366F1',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#1F2937',
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  inputContainer: {
    padding: 8,
    backgroundColor: '#fff',
  },
  input: {
    backgroundColor: '#fff',
  },
});
