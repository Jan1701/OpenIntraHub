import { useEffect, useState } from 'react';
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
  Card,
  Searchbar,
  FAB,
  Chip,
  Avatar,
  ProgressBar,
  Surface,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { projectsApi } from '@/services/api';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  color?: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  completedTaskCount?: number;
  members?: Array<{
    id: string;
    username: string;
    firstName?: string;
    avatar?: string;
  }>;
}

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadProjects = async () => {
    try {
      const data = await projectsApi.getProjects();
      setProjects(data);
      applyFilters(data, searchQuery, filter);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (
    projectList: Project[],
    query: string,
    statusFilter: string
  ) => {
    let filtered = projectList;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Apply search filter
    if (query.trim()) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description?.toLowerCase().includes(query.toLowerCase())
      );
    }

    setFilteredProjects(filtered);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    applyFilters(projects, searchQuery, filter);
  }, [searchQuery, filter, projects]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'completed':
        return '#3B82F6';
      case 'archived':
        return '#9CA3AF';
      default:
        return '#6B7280';
    }
  };

  const getProgress = (project: Project): number => {
    if (!project.taskCount || project.taskCount === 0) return 0;
    return (project.completedTaskCount || 0) / project.taskCount;
  };

  const isDark = colorScheme === 'dark';

  const renderProject = ({ item: project }: { item: Project }) => (
    <Card
      style={[styles.projectCard, { borderLeftColor: project.color || '#3B82F6' }]}
      onPress={() => router.push(`/projects/${project.id}`)}
    >
      <Card.Content>
        <View style={styles.projectHeader}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectName} numberOfLines={1}>
              {project.name}
            </Text>
            <Chip
              mode="flat"
              style={[
                styles.statusChip,
                { backgroundColor: getStatusColor(project.status) + '20' },
              ]}
              textStyle={[styles.statusText, { color: getStatusColor(project.status) }]}
            >
              {t(`projects.status.${project.status}`, project.status)}
            </Chip>
          </View>

          {project.description && (
            <Text style={styles.projectDescription} numberOfLines={2}>
              {project.description}
            </Text>
          )}
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {t('projects.progress', 'Progress')}
            </Text>
            <Text style={styles.progressValue}>
              {project.completedTaskCount || 0} / {project.taskCount || 0}
            </Text>
          </View>
          <ProgressBar
            progress={getProgress(project)}
            color="#3B82F6"
            style={styles.progressBar}
          />
        </View>

        {/* Footer */}
        <View style={styles.projectFooter}>
          {/* Members */}
          <View style={styles.membersContainer}>
            {project.members?.slice(0, 3).map((member, index) => (
              <Avatar.Text
                key={member.id}
                size={28}
                label={member.firstName?.[0] || member.username[0].toUpperCase()}
                style={[
                  styles.memberAvatar,
                  { marginLeft: index > 0 ? -8 : 0 },
                ]}
              />
            ))}
            {project.members && project.members.length > 3 && (
              <View style={[styles.memberAvatar, styles.moreMembers]}>
                <Text style={styles.moreMembersText}>
                  +{project.members.length - 3}
                </Text>
              </View>
            )}
          </View>

          {/* Tasks Count */}
          <View style={styles.taskCountContainer}>
            <MaterialCommunityIcons name="checkbox-marked-outline" size={16} color="#6B7280" />
            <Text style={styles.taskCountText}>
              {project.taskCount || 0} {t('projects.tasks', 'tasks')}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
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
      {/* Search */}
      <Surface style={styles.searchContainer} elevation={1}>
        <Searchbar
          placeholder={t('projects.searchPlaceholder', 'Search projects...')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </Surface>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <Chip
          mode={filter === 'all' ? 'flat' : 'outlined'}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          style={styles.filterChip}
        >
          {t('projects.all', 'All')}
        </Chip>
        <Chip
          mode={filter === 'active' ? 'flat' : 'outlined'}
          selected={filter === 'active'}
          onPress={() => setFilter('active')}
          style={styles.filterChip}
        >
          {t('projects.active', 'Active')}
        </Chip>
        <Chip
          mode={filter === 'completed' ? 'flat' : 'outlined'}
          selected={filter === 'completed'}
          onPress={() => setFilter('completed')}
          style={styles.filterChip}
        >
          {t('projects.completed', 'Completed')}
        </Chip>
      </View>

      {/* Projects List */}
      <FlatList
        data={filteredProjects}
        renderItem={renderProject}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={64}
              color="#9CA3AF"
            />
            <Text style={styles.emptyText}>
              {searchQuery || filter !== 'all'
                ? t('projects.noResults', 'No projects found')
                : t('projects.noProjects', 'No projects yet')}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/projects/new')}
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
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterChip: {
    marginRight: 0,
  },
  listContent: {
    padding: 12,
  },
  projectCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  projectHeader: {
    marginBottom: 12,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    height: 24,
  },
  statusText: {
    fontSize: 11,
  },
  projectDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressValue: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    backgroundColor: '#6366F1',
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreMembers: {
    backgroundColor: '#E5E7EB',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  moreMembersText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  taskCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskCountText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3B82F6',
  },
});
