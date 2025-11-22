import { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Avatar,
  Searchbar,
  FAB,
  Badge,
  Divider,
  Surface,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { format, isToday, isYesterday } from 'date-fns';

interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
    senderName?: string;
  };
  participants: Array<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    status?: string;
  }>;
  unreadCount: number;
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = async () => {
    try {
      const data = await chatApi.getConversations();
      setConversations(data);
      setFilteredConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    socketService.connect();

    // Listen for new messages
    const unsubscribe = socketService.on('chat:message', (data: unknown) => {
      loadConversations();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = conversations.filter((conv) =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.participants.some(
          (p) =>
            p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.firstName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchQuery, conversations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return t('chat.yesterday', 'Yesterday');
    }
    return format(date, 'dd.MM');
  };

  const getConversationName = (conv: Conversation): string => {
    if (conv.isGroup) {
      return conv.name;
    }
    const otherParticipant = conv.participants[0];
    return otherParticipant?.firstName || otherParticipant?.username || 'Unknown';
  };

  const getAvatarLabel = (conv: Conversation): string => {
    const name = getConversationName(conv);
    return name.substring(0, 2).toUpperCase();
  };

  const isDark = colorScheme === 'dark';

  const renderConversation = ({ item: conv }: { item: Conversation }) => (
    <TouchableOpacity
      onPress={() => router.push(`/chat/${conv.id}`)}
      style={styles.conversationItem}
    >
      <View style={styles.avatarContainer}>
        <Avatar.Text
          size={50}
          label={getAvatarLabel(conv)}
          style={[
            styles.avatar,
            conv.isGroup && styles.groupAvatar,
          ]}
        />
        {!conv.isGroup && conv.participants[0]?.status === 'available' && (
          <View style={styles.onlineIndicator} />
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {getConversationName(conv)}
          </Text>
          {conv.lastMessage && (
            <Text style={styles.timeText}>
              {formatTime(conv.lastMessage.createdAt)}
            </Text>
          )}
        </View>

        <View style={styles.conversationFooter}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {conv.lastMessage?.content || t('chat.noMessages', 'No messages yet')}
          </Text>
          {conv.unreadCount > 0 && (
            <Badge style={styles.unreadBadge}>{conv.unreadCount}</Badge>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Surface style={styles.searchContainer} elevation={1}>
        <Searchbar
          placeholder={t('chat.searchPlaceholder', 'Search conversations...')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </Surface>

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t('chat.noResults', 'No conversations found')
                : t('chat.noConversations', 'No conversations yet')}
            </Text>
          </View>
        }
        contentContainerStyle={
          filteredConversations.length === 0 && styles.emptyList
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/chat/new')}
        color="#fff"
      />
    </View>
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
  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
  },
  searchbar: {
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: '#3B82F6',
  },
  groupAvatar: {
    backgroundColor: '#8B5CF6',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
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
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3B82F6',
  },
});
