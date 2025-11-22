import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import {
  Text,
  Card,
  Avatar,
  Chip,
  Surface,
  IconButton,
  Divider,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { chatApi, eventsApi, projectsApi } from '@/services/api';
import { format } from 'date-fns';

interface QuickStats {
  unreadMessages: number;
  todayEvents: number;
  activeTasks: number;
  recentFiles: number;
}

interface RecentActivity {
  id: string;
  type: 'message' | 'event' | 'task' | 'file';
  title: string;
  description: string;
  time: string;
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const user = useAuthStore((state) => state.user);

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<QuickStats>({
    unreadMessages: 0,
    todayEvents: 0,
    activeTasks: 0,
    recentFiles: 0,
  });
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  const loadDashboardData = async () => {
    try {
      // Load conversations for unread count
      const conversations = await chatApi.getConversations();
      const unreadMessages = conversations.reduce(
        (sum: number, conv: { unreadCount?: number }) => sum + (conv.unreadCount || 0),
        0
      );

      // Load today's events
      const today = new Date();
      const events = await eventsApi.getEvents(
        today.toISOString(),
        new Date(today.setHours(23, 59, 59)).toISOString()
      );

      // Load projects for task count
      const projects = await projectsApi.getProjects();
      const activeTasks = projects.reduce(
        (sum: number, proj: { taskCount?: number }) => sum + (proj.taskCount || 0),
        0
      );

      setStats({
        unreadMessages,
        todayEvents: events.length || 0,
        activeTasks,
        recentFiles: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const isDark = colorScheme === 'dark';

  const QuickActionCard = ({
    icon,
    title,
    count,
    color,
    onPress,
  }: {
    icon: string;
    title: string;
    count: number;
    color: string;
    onPress: () => void;
  }) => (
    <Card style={styles.quickActionCard} onPress={onPress}>
      <Card.Content style={styles.quickActionContent}>
        <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
          <IconButton icon={icon} iconColor={color} size={24} />
        </View>
        <Text style={styles.quickActionCount}>{count}</Text>
        <Text style={styles.quickActionTitle}>{title}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Header */}
      <Surface style={styles.welcomeCard} elevation={1}>
        <View style={styles.welcomeContent}>
          <Avatar.Text
            size={56}
            label={user?.firstName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
            style={styles.avatar}
          />
          <View style={styles.welcomeText}>
            <Text style={styles.greeting}>
              {t('dashboard.welcome', 'Welcome back')},
            </Text>
            <Text style={styles.userName}>
              {user?.firstName || user?.username || 'User'}!
            </Text>
            <Chip icon="circle" style={styles.statusChip} textStyle={styles.statusText}>
              {user?.status || 'Available'}
            </Chip>
          </View>
        </View>
      </Surface>

      {/* Quick Actions Grid */}
      <Text style={styles.sectionTitle}>{t('dashboard.quickActions', 'Quick Actions')}</Text>
      <View style={styles.quickActionsGrid}>
        <QuickActionCard
          icon="chat"
          title={t('nav.chat', 'Chat')}
          count={stats.unreadMessages}
          color="#3B82F6"
          onPress={() => router.push('/(tabs)/chat')}
        />
        <QuickActionCard
          icon="calendar"
          title={t('dashboard.events', 'Events')}
          count={stats.todayEvents}
          color="#10B981"
          onPress={() => router.push('/events')}
        />
        <QuickActionCard
          icon="clipboard-check"
          title={t('dashboard.tasks', 'Tasks')}
          count={stats.activeTasks}
          color="#F59E0B"
          onPress={() => router.push('/(tabs)/projects')}
        />
        <QuickActionCard
          icon="folder"
          title={t('nav.drive', 'Drive')}
          count={stats.recentFiles}
          color="#8B5CF6"
          onPress={() => router.push('/(tabs)/drive')}
        />
      </View>

      {/* Quick Links */}
      <Text style={styles.sectionTitle}>{t('dashboard.quickLinks', 'Quick Links')}</Text>
      <Surface style={styles.quickLinksCard} elevation={1}>
        <Card.Content>
          <View style={styles.quickLinkRow}>
            <IconButton icon="post" iconColor="#3B82F6" size={24} />
            <Text style={styles.quickLinkText}>{t('nav.posts', 'Posts & News')}</Text>
            <IconButton icon="chevron-right" size={24} onPress={() => router.push('/posts')} />
          </View>
          <Divider />
          <View style={styles.quickLinkRow}>
            <IconButton icon="map-marker" iconColor="#10B981" size={24} />
            <Text style={styles.quickLinkText}>{t('nav.locations', 'Locations')}</Text>
            <IconButton icon="chevron-right" size={24} onPress={() => router.push('/locations')} />
          </View>
          <Divider />
          <View style={styles.quickLinkRow}>
            <IconButton icon="email" iconColor="#F59E0B" size={24} />
            <Text style={styles.quickLinkText}>{t('nav.mail', 'Mail')}</Text>
            <IconButton icon="chevron-right" size={24} onPress={() => router.push('/mail')} />
          </View>
        </Card.Content>
      </Surface>

      {/* Today's Date */}
      <Surface style={styles.dateCard} elevation={1}>
        <Text style={styles.dateText}>
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </Text>
      </Surface>
    </ScrollView>
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
  welcomeCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#fff',
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#3B82F6',
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    color: '#059669',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  quickActionCard: {
    width: '46%',
    margin: '2%',
    borderRadius: 12,
  },
  quickActionContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconCircle: {
    borderRadius: 30,
    marginBottom: 8,
  },
  quickActionCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  quickActionTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  quickLinksCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quickLinkText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  dateCard: {
    margin: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
