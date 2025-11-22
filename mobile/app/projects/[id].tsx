import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  FAB,
  Surface,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
  Button,
  Avatar,
} from 'react-native-paper';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { projectsApi } from '@/services/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: {
    id: string;
    username: string;
    firstName?: string;
    avatar?: string;
  };
  dueDate?: string;
  position: number;
}

interface Column {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Board {
  id: string;
  name: string;
  columns: Column[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  boards: Board[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH * 0.8;

export default function ProjectKanbanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTaskModal, setNewTaskModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');

  const loadProject = async () => {
    try {
      const [projectData, boardsData, tasksData] = await Promise.all([
        projectsApi.getProject(id!),
        projectsApi.getBoards(id!),
        projectsApi.getTasks(id!),
      ]);

      setProject({ ...projectData, boards: boardsData });
      setTasks(tasksData);

      if (boardsData.length > 0 && !currentBoard) {
        setCurrentBoard(boardsData[0]);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProject();
    setRefreshing(false);
  };

  const createTask = async () => {
    if (!newTaskTitle.trim() || !selectedColumn) return;

    try {
      const newTask = await projectsApi.createTask(id!, {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        columnId: selectedColumn,
      });

      setTasks([...tasks, newTask]);
      setNewTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setSelectedColumn(null);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const getTasksByColumn = (columnId: string) => {
    return tasks
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent':
        return '#EF4444';
      case 'high':
        return '#F59E0B';
      case 'medium':
        return '#3B82F6';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const isDark = colorScheme === 'dark';

  const renderTask = (task: Task) => (
    <Card
      key={task.id}
      style={styles.taskCard}
      onPress={() => router.push(`/projects/${id}/tasks/${task.id}`)}
    >
      <Card.Content>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {task.title}
          </Text>
          <View
            style={[
              styles.priorityDot,
              { backgroundColor: getPriorityColor(task.priority) },
            ]}
          />
        </View>

        {task.description && (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        <View style={styles.taskFooter}>
          {task.assignee && (
            <Avatar.Text
              size={24}
              label={
                task.assignee.firstName?.[0] ||
                task.assignee.username[0].toUpperCase()
              }
              style={styles.assigneeAvatar}
            />
          )}

          {task.dueDate && (
            <Chip
              icon="calendar"
              mode="outlined"
              style={styles.dueDateChip}
              textStyle={styles.dueDateText}
            >
              {new Date(task.dueDate).toLocaleDateString()}
            </Chip>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderColumn = (column: Column) => {
    const columnTasks = getTasksByColumn(column.id);

    return (
      <View key={column.id} style={styles.column}>
        <Surface style={styles.columnHeader} elevation={1}>
          <View style={[styles.columnColorBar, { backgroundColor: column.color }]} />
          <Text style={styles.columnTitle}>{column.name}</Text>
          <Chip mode="flat" style={styles.taskCountChip}>
            {columnTasks.length}
          </Chip>
          <IconButton
            icon="plus"
            size={20}
            onPress={() => {
              setSelectedColumn(column.id);
              setNewTaskModal(true);
            }}
          />
        </Surface>

        <ScrollView
          style={styles.columnContent}
          showsVerticalScrollIndicator={false}
        >
          {columnTasks.map(renderTask)}

          {columnTasks.length === 0 && (
            <View style={styles.emptyColumn}>
              <MaterialCommunityIcons
                name="card-outline"
                size={32}
                color="#D1D5DB"
              />
              <Text style={styles.emptyColumnText}>
                {t('projects.noTasks', 'No tasks')}
              </Text>
            </View>
          )}
        </ScrollView>
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
          title: project?.name || t('nav.projects', 'Projects'),
          headerBackTitle: t('nav.projects', 'Projects'),
        }}
      />

      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Board Selector */}
        {project?.boards && project.boards.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.boardSelector}
          >
            {project.boards.map((board) => (
              <Chip
                key={board.id}
                mode={currentBoard?.id === board.id ? 'flat' : 'outlined'}
                selected={currentBoard?.id === board.id}
                onPress={() => setCurrentBoard(board)}
                style={styles.boardChip}
              >
                {board.name}
              </Chip>
            ))}
          </ScrollView>
        )}

        {/* Kanban Board */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kanbanContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {currentBoard?.columns
            .sort((a, b) => a.position - b.position)
            .map(renderColumn)}
        </ScrollView>

        {/* New Task Modal */}
        <Portal>
          <Modal
            visible={newTaskModal}
            onDismiss={() => {
              setNewTaskModal(false);
              setNewTaskTitle('');
              setNewTaskDescription('');
            }}
            contentContainerStyle={styles.modalContent}
          >
            <Text style={styles.modalTitle}>
              {t('projects.newTask', 'New Task')}
            </Text>

            <TextInput
              label={t('projects.taskTitle', 'Task Title')}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              mode="outlined"
              style={styles.modalInput}
            />

            <TextInput
              label={t('projects.taskDescription', 'Description')}
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setNewTaskModal(false)}
                style={styles.modalButton}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={createTask}
                disabled={!newTaskTitle.trim()}
                style={styles.modalButton}
              >
                {t('common.create', 'Create')}
              </Button>
            </View>
          </Modal>
        </Portal>

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => {
            if (currentBoard?.columns.length) {
              setSelectedColumn(currentBoard.columns[0].id);
              setNewTaskModal(true);
            }
          }}
          color="#fff"
        />
      </View>
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
  boardSelector: {
    maxHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  boardChip: {
    marginRight: 8,
  },
  kanbanContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  column: {
    width: COLUMN_WIDTH,
    marginHorizontal: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    maxHeight: '100%',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#fff',
  },
  columnColorBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginRight: 12,
  },
  columnTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  taskCountChip: {
    height: 24,
    marginRight: 4,
  },
  columnContent: {
    padding: 8,
    flex: 1,
  },
  taskCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  taskDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  assigneeAvatar: {
    backgroundColor: '#6366F1',
  },
  dueDateChip: {
    height: 24,
    backgroundColor: 'transparent',
  },
  dueDateText: {
    fontSize: 10,
  },
  emptyColumn: {
    alignItems: 'center',
    padding: 24,
  },
  emptyColumnText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3B82F6',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1F2937',
  },
  modalInput: {
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalButton: {
    marginLeft: 12,
  },
});
