import { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  useColorScheme,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Searchbar,
  FAB,
  IconButton,
  Menu,
  Divider,
  Surface,
  ActivityIndicator,
  Portal,
  Dialog,
  TextInput,
  Button,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { driveApi } from '@/services/api';
import { format } from 'date-fns';

interface DriveItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
}

export default function DriveScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const [items, setItems] = useState<DriveItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  const loadItems = async (folderId?: string) => {
    try {
      const [folders, files] = await Promise.all([
        driveApi.getFolders(folderId),
        driveApi.getFiles(folderId),
      ]);

      const allItems: DriveItem[] = [
        ...folders.map((f: DriveItem) => ({ ...f, type: 'folder' as const })),
        ...files.map((f: DriveItem) => ({ ...f, type: 'file' as const })),
      ];

      setItems(allItems);
    } catch (error) {
      console.error('Error loading drive items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(currentFolder);
  }, [currentFolder]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems(currentFolder);
    setRefreshing(false);
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setFolderPath([...folderPath, { id: folderId, name: folderName }]);
    setCurrentFolder(folderId);
    setLoading(true);
  };

  const navigateBack = () => {
    if (folderPath.length === 0) return;

    const newPath = [...folderPath];
    newPath.pop();
    setFolderPath(newPath);
    setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1].id : undefined);
    setLoading(true);
  };

  const navigateToRoot = () => {
    setFolderPath([]);
    setCurrentFolder(undefined);
    setLoading(true);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await driveApi.createFolder(newFolderName.trim(), currentFolder);
      setNewFolderDialog(false);
      setNewFolderName('');
      onRefresh();
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert(t('drive.error', 'Error'), t('drive.createFolderError', 'Failed to create folder'));
    }
  };

  const uploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as unknown as Blob);

      setLoading(true);
      await driveApi.uploadFile(formData, currentFolder);
      onRefresh();
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert(t('drive.error', 'Error'), t('drive.uploadError', 'Failed to upload file'));
      setLoading(false);
    }
  };

  const deleteItem = async (item: DriveItem) => {
    Alert.alert(
      t('drive.confirmDelete', 'Delete'),
      t('drive.confirmDeleteMessage', `Are you sure you want to delete "${item.name}"?`),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.type === 'folder') {
                await driveApi.deleteFolder(item.id);
              } else {
                await driveApi.deleteFile(item.id);
              }
              onRefresh();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert(t('drive.error', 'Error'), t('drive.deleteError', 'Failed to delete'));
            }
          },
        },
      ]
    );
  };

  const getFileIcon = (mimeType?: string): string => {
    if (!mimeType) return 'file-outline';
    if (mimeType.startsWith('image/')) return 'file-image-outline';
    if (mimeType.startsWith('video/')) return 'file-video-outline';
    if (mimeType.startsWith('audio/')) return 'file-music-outline';
    if (mimeType.includes('pdf')) return 'file-pdf-box';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word-outline';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel-outline';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-powerpoint-outline';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'folder-zip-outline';
    return 'file-outline';
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const isDark = colorScheme === 'dark';

  const filteredItems = searchQuery.trim()
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const renderItem = ({ item }: { item: DriveItem }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => {
        if (item.type === 'folder') {
          navigateToFolder(item.id, item.name);
        } else {
          router.push(`/drive/file/${item.id}`);
        }
      }}
    >
      <MaterialCommunityIcons
        name={item.type === 'folder' ? 'folder' : getFileIcon(item.mimeType)}
        size={40}
        color={item.type === 'folder' ? '#F59E0B' : '#3B82F6'}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.itemMeta}>
          {format(new Date(item.updatedAt), 'dd.MM.yyyy')}
          {item.size && ` • ${formatFileSize(item.size)}`}
        </Text>
      </View>

      <Menu
        visible={menuVisible === item.id}
        onDismiss={() => setMenuVisible(null)}
        anchor={
          <IconButton
            icon="dots-vertical"
            onPress={() => setMenuVisible(item.id)}
          />
        }
      >
        <Menu.Item
          onPress={() => {
            setMenuVisible(null);
            // Share logic
          }}
          title={t('drive.share', 'Share')}
          leadingIcon="share-variant"
        />
        <Menu.Item
          onPress={() => {
            setMenuVisible(null);
            deleteItem(item);
          }}
          title={t('common.delete', 'Delete')}
          leadingIcon="delete"
        />
      </Menu>
    </TouchableOpacity>
  );

  if (loading && items.length === 0) {
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
          placeholder={t('drive.searchPlaceholder', 'Search files...')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </Surface>

      {/* Breadcrumb */}
      <Surface style={styles.breadcrumbContainer} elevation={1}>
        <TouchableOpacity onPress={navigateToRoot} style={styles.breadcrumbItem}>
          <MaterialCommunityIcons name="home" size={20} color="#3B82F6" />
          <Text style={styles.breadcrumbText}>{t('drive.root', 'My Drive')}</Text>
        </TouchableOpacity>
        {folderPath.map((folder, index) => (
          <View key={folder.id} style={styles.breadcrumbItem}>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
            <TouchableOpacity
              onPress={() => {
                const newPath = folderPath.slice(0, index + 1);
                setFolderPath(newPath);
                setCurrentFolder(folder.id);
                setLoading(true);
              }}
            >
              <Text style={styles.breadcrumbText}>{folder.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Surface>

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="folder-open-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              {t('drive.emptyFolder', 'This folder is empty')}
            </Text>
          </View>
        }
        contentContainerStyle={filteredItems.length === 0 && styles.emptyList}
      />

      {/* FAB Group */}
      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        actions={[
          {
            icon: 'folder-plus',
            label: t('drive.newFolder', 'New Folder'),
            onPress: () => setNewFolderDialog(true),
          },
          {
            icon: 'file-upload',
            label: t('drive.uploadFile', 'Upload File'),
            onPress: uploadFile,
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        fabStyle={styles.fab}
      />

      {/* New Folder Dialog */}
      <Portal>
        <Dialog visible={newFolderDialog} onDismiss={() => setNewFolderDialog(false)}>
          <Dialog.Title>{t('drive.newFolder', 'New Folder')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('drive.folderName', 'Folder Name')}
              value={newFolderName}
              onChangeText={setNewFolderName}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewFolderDialog(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button onPress={createFolder}>{t('common.create', 'Create')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#3B82F6',
    marginLeft: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  itemMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
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
    marginTop: 16,
  },
  emptyList: {
    flex: 1,
  },
  fab: {
    backgroundColor: '#3B82F6',
  },
});
