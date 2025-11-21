// =====================================================
// Drive Advanced - Professional File Manager with Premium Features
// =====================================================

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderIcon,
  FileIcon,
  UploadIcon,
  DownloadIcon,
  TrashIcon,
  ShareIcon,
  SearchIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  HomeIcon,
  ChevronRightIcon,
  EyeIcon,
  LockIcon,
  UsersIcon,
  EditIcon,
  MoveIcon,
  CheckSquareIcon,
  SquareIcon,
  XIcon,
  HistoryIcon,
  CopyIcon,
  ImageIcon,
  FileTextIcon,
  VideoIcon,
  MusicIcon
} from 'lucide-react';
import api from '../../services/api';

function DriveAdvanced() {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // State
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: t('drive:myDrive') }]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Drag & Drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);

  // Selection state (Bulk Actions)
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Modal states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  // Modal data
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [shareUsers, setShareUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [fileVersions, setFileVersions] = useState([]);

  // Stats state
  const [stats, setStats] = useState(null);

  // Load content
  useEffect(() => {
    loadContent();
    loadStats();
  }, [currentFolderId, sortBy, sortOrder, searchTerm]);

  // Load users for sharing
  useEffect(() => {
    loadUsers();
  }, []);

  // Drag & Drop handlers
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target === dropZone) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleMultiFileUpload(files);
    };

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [currentFolderId]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const foldersRes = await api.get('/drive/folders', {
        params: { parentId: currentFolderId }
      });
      setFolders(foldersRes.data.data || []);

      const filesRes = await api.get('/drive/files', {
        params: {
          folderId: currentFolderId,
          sortBy,
          sortOrder,
          search: searchTerm || undefined
        }
      });
      setFiles(filesRes.data.data || []);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/drive/stats');
      setStats(res.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  // Navigation
  const navigateToFolder = (folderId, folderName) => {
    setCurrentFolderId(folderId);
    if (folderId === null) {
      setBreadcrumb([{ id: null, name: t('drive:myDrive') }]);
    } else {
      setBreadcrumb([...breadcrumb, { id: folderId, name: folderName }]);
    }
    setSelectedItems([]);
    setSelectionMode(false);
  };

  const navigateToBreadcrumb = (index) => {
    const item = breadcrumb[index];
    setCurrentFolderId(item.id);
    setBreadcrumb(breadcrumb.slice(0, index + 1));
    setSelectedItems([]);
    setSelectionMode(false);
  };

  // Multi-File Upload
  const handleMultiFileUpload = async (files) => {
    const uploads = files.map((file, index) => ({
      id: Date.now() + index,
      file,
      progress: 0,
      status: 'pending' // pending, uploading, success, error
    }));

    setUploadQueue(uploads);
    setUploadModalOpen(true);

    for (const upload of uploads) {
      await uploadSingleFile(upload);
    }

    // Close modal after 2 seconds
    setTimeout(() => {
      setUploadModalOpen(false);
      setUploadQueue([]);
      loadContent();
      loadStats();
    }, 2000);
  };

  const uploadSingleFile = async (uploadItem) => {
    const formData = new FormData();
    formData.append('file', uploadItem.file);
    if (currentFolderId) {
      formData.append('folderId', currentFolderId);
    }

    setUploadQueue(prev =>
      prev.map(item =>
        item.id === uploadItem.id ? { ...item, status: 'uploading' } : item
      )
    );

    try {
      await api.post('/drive/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadQueue(prev =>
            prev.map(item =>
              item.id === uploadItem.id ? { ...item, progress: percentCompleted } : item
            )
          );
        }
      });

      setUploadQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id ? { ...item, status: 'success', progress: 100 } : item
        )
      );
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id ? { ...item, status: 'error' } : item
        )
      );
    }
  };

  // Create folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post('/drive/folders', {
        name: newFolderName,
        parentId: currentFolderId
      });
      setFolderModalOpen(false);
      setNewFolderName('');
      loadContent();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(t('drive:errors.createFailed'));
    }
  };

  // Rename file/folder
  const openRenameModal = (item, isFolder = false) => {
    if (isFolder) {
      setSelectedFolder(item);
      setRenameName(item.name);
    } else {
      setSelectedFile(item);
      setRenameName(item.name);
    }
    setRenameModalOpen(true);
  };

  const renameItem = async () => {
    if (!renameName.trim()) return;

    try {
      if (selectedFile) {
        await api.put(`/drive/files/${selectedFile.id}`, {
          name: renameName
        });
      } else if (selectedFolder) {
        await api.put(`/drive/folders/${selectedFolder.id}`, {
          name: renameName
        });
      }
      setRenameModalOpen(false);
      setSelectedFile(null);
      setSelectedFolder(null);
      setRenameName('');
      loadContent();
    } catch (error) {
      console.error('Rename failed:', error);
      alert(t('drive:errors.updateFailed'));
    }
  };

  // Move file/folder
  const openMoveModal = (item, isFolder = false) => {
    if (isFolder) {
      setSelectedFolder(item);
    } else {
      setSelectedFile(item);
    }
    setMoveModalOpen(true);
  };

  const moveItem = async (targetFolderId) => {
    try {
      if (selectedFile) {
        await api.put(`/drive/files/${selectedFile.id}`, {
          folderId: targetFolderId
        });
      } else if (selectedFolder) {
        await api.put(`/drive/folders/${selectedFolder.id}`, {
          parentId: targetFolderId
        });
      }
      setMoveModalOpen(false);
      setSelectedFile(null);
      setSelectedFolder(null);
      loadContent();
    } catch (error) {
      console.error('Move failed:', error);
      alert(t('drive:errors.updateFailed'));
    }
  };

  // Download file
  const downloadFile = async (fileId, fileName) => {
    try {
      const response = await api.get(`/drive/files/${fileId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
      alert(t('drive:errors.downloadFailed'));
    }
  };

  // Delete file/folder
  const deleteItem = async (item, isFolder = false) => {
    if (!confirm(isFolder ? t('drive:delete.confirmFolder') : t('drive:delete.confirm'))) return;

    try {
      if (isFolder) {
        await api.delete(`/drive/folders/${item.id}`);
      } else {
        await api.delete(`/drive/files/${item.id}`);
      }
      loadContent();
      loadStats();
    } catch (error) {
      console.error('Delete failed:', error);
      alert(t('drive:errors.deleteFailed'));
    }
  };

  // File Preview
  const openPreview = (file) => {
    setPreviewFile(file);
    setPreviewModalOpen(true);
  };

  const canPreview = (file) => {
    const mimeType = file.mime_type || '';
    return mimeType.startsWith('image/') ||
           mimeType === 'application/pdf' ||
           mimeType.startsWith('video/') ||
           mimeType.startsWith('audio/');
  };

  const getPreviewContent = (file) => {
    const mimeType = file.mime_type || '';
    const url = `/api/drive/files/${file.id}/download`;

    if (mimeType.startsWith('image/')) {
      return <img src={url} alt={file.name} className="max-w-full max-h-[70vh] mx-auto" />;
    } else if (mimeType === 'application/pdf') {
      return <iframe src={url} className="w-full h-[70vh]" title={file.name} />;
    } else if (mimeType.startsWith('video/')) {
      return <video src={url} controls className="max-w-full max-h-[70vh] mx-auto" />;
    } else if (mimeType.startsWith('audio/')) {
      return <audio src={url} controls className="w-full" />;
    }
    return <p className="text-gray-500">Preview not available</p>;
  };

  // Advanced Sharing
  const openShareModal = (file) => {
    setSelectedFile(file);
    setShareUsers([]);
    setShareModalOpen(true);
  };

  const shareWithUsers = async () => {
    if (shareUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }

    try {
      for (const userId of shareUsers) {
        await api.post(`/drive/files/${selectedFile.id}/share`, {
          sharedWithUserId: userId,
          permission: 'read'
        });
      }
      alert(t('drive:share.success'));
      setShareModalOpen(false);
      setSelectedFile(null);
      setShareUsers([]);
    } catch (error) {
      console.error('Share failed:', error);
      alert(t('drive:errors.shareFailed'));
    }
  };

  const createPublicLink = async () => {
    try {
      const res = await api.post(`/drive/files/${selectedFile.id}/public-link`);
      navigator.clipboard.writeText(res.data.data.url);
      alert(t('drive:share.linkCopied'));
    } catch (error) {
      alert(t('drive:errors.shareFailed'));
    }
  };

  // File Versioning
  const openVersionModal = async (file) => {
    setSelectedFile(file);
    try {
      const res = await api.get(`/drive/files/${file.id}/versions`);
      setFileVersions(res.data.data || []);
      setVersionModalOpen(true);
    } catch (error) {
      console.error('Failed to load versions:', error);
      setFileVersions([]);
      setVersionModalOpen(true);
    }
  };

  const restoreVersion = async (versionId) => {
    if (!confirm('Restore this version?')) return;

    try {
      await api.post(`/drive/files/${selectedFile.id}/restore-version`, {
        versionId
      });
      alert('Version restored');
      setVersionModalOpen(false);
      loadContent();
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Failed to restore version');
    }
  };

  // Bulk Actions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedItems([]);
  };

  const toggleItemSelection = (item, isFolder = false) => {
    const itemKey = isFolder ? `folder-${item.id}` : `file-${item.id}`;

    if (selectedItems.includes(itemKey)) {
      setSelectedItems(selectedItems.filter(key => key !== itemKey));
    } else {
      setSelectedItems([...selectedItems, itemKey]);
    }
  };

  const isItemSelected = (item, isFolder = false) => {
    const itemKey = isFolder ? `folder-${item.id}` : `file-${item.id}`;
    return selectedItems.includes(itemKey);
  };

  const bulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Delete ${selectedItems.length} items?`)) return;

    try {
      for (const itemKey of selectedItems) {
        const [type, id] = itemKey.split('-');
        if (type === 'file') {
          await api.delete(`/drive/files/${id}`);
        } else if (type === 'folder') {
          await api.delete(`/drive/folders/${id}`);
        }
      }
      setSelectedItems([]);
      setSelectionMode(false);
      loadContent();
      loadStats();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Some items could not be deleted');
    }
  };

  const bulkDownload = async () => {
    if (selectedItems.length === 0) return;

    for (const itemKey of selectedItems) {
      const [type, id] = itemKey.split('-');
      if (type === 'file') {
        const file = files.find(f => f.id === parseInt(id));
        if (file) {
          await downloadFile(file.id, file.name);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  };

  // Helper functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType?.startsWith('video/')) return '🎥';
    if (mimeType?.startsWith('audio/')) return '🎵';
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
    if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return '📊';
    if (mimeType?.includes('zip') || mimeType?.includes('archive')) return '📦';
    return '📄';
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'private': return <LockIcon className="w-4 h-4 text-gray-500" />;
      case 'shared': return <UsersIcon className="w-4 h-4 text-blue-500" />;
      case 'public': return <EyeIcon className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6" ref={dropZoneRef}>
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500 bg-opacity-20 border-4 border-dashed border-blue-600 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 shadow-2xl">
            <UploadIcon className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <p className="text-xl font-bold text-gray-900">{t('drive:upload.dragDrop')}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('drive:title')}</h1>
        <p className="text-gray-600">{t('drive:subtitle')}</p>
      </div>

      {/* Storage Stats */}
      {stats && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{t('drive:stats.storageUsage')}</span>
            <span className="text-sm text-gray-600">
              {formatFileSize(stats.storage.used)} / {formatFileSize(stats.storage.quota)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.storage.percentage > 90 ? 'bg-red-600' :
                stats.storage.percentage > 75 ? 'bg-yellow-600' :
                'bg-blue-600'
              }`}
              style={{ width: `${Math.min(stats.storage.percentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{stats.files.total_files} {t('drive:files.title')}</span>
            <span>{stats.folders.total} {t('drive:folders.title')}</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Actions */}
          {!selectionMode ? (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <UploadIcon className="w-4 h-4 mr-2" />
                {t('drive:files.upload')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    handleMultiFileUpload(Array.from(e.target.files));
                  }
                }}
                className="hidden"
              />

              <button
                onClick={() => setFolderModalOpen(true)}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                {t('drive:folders.new')}
              </button>

              <button
                onClick={toggleSelectionMode}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <CheckSquareIcon className="w-4 h-4 mr-2" />
                Select
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-gray-700">
                {selectedItems.length} selected
              </span>
              <button
                onClick={bulkDownload}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                disabled={selectedItems.length === 0}
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download
              </button>
              <button
                onClick={bulkDelete}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                disabled={selectedItems.length === 0}
              >
                <TrashIcon className="w-4 h-4 mr-2" />
                Delete
              </button>
              <button
                onClick={toggleSelectionMode}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <XIcon className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </>
          )}

          {/* Search */}
          {!selectionMode && (
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('drive:search.placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* View Mode */}
          {!selectionMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ListIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <GridIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        {breadcrumb.map((item, index) => (
          <React.Fragment key={item.id || 'root'}>
            {index > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 ${
                index === breadcrumb.length - 1 ? 'text-blue-600 font-medium' : 'text-gray-600'
              }`}
            >
              {index === 0 && <HomeIcon className="w-4 h-4" />}
              {item.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-600">{t('common:general.loading')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          {viewMode === 'list' ? (
            <div className="divide-y divide-gray-200">
              {/* Folders */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center p-4 hover:bg-gray-50"
                >
                  {selectionMode && (
                    <button
                      onClick={() => toggleItemSelection(folder, true)}
                      className="mr-3"
                    >
                      {isItemSelected(folder, true) ? (
                        <CheckSquareIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  <div
                    className="flex items-center flex-1 cursor-pointer"
                    onClick={() => !selectionMode && navigateToFolder(folder.id, folder.name)}
                  >
                    <FolderIcon className="w-10 h-10 text-blue-500 mr-4" />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{folder.name}</h3>
                      <p className="text-sm text-gray-500">
                        {folder.file_count} {t('drive:files.title')} · {formatFileSize(folder.total_size_bytes)}
                      </p>
                    </div>
                  </div>
                  {!selectionMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openRenameModal(folder, true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Rename"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openMoveModal(folder, true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Move"
                      >
                        <MoveIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(folder, true)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title={t('drive:files.delete')}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Files */}
              {files.map((file) => (
                <div key={file.id} className="flex items-center p-4 hover:bg-gray-50">
                  {selectionMode && (
                    <button
                      onClick={() => toggleItemSelection(file, false)}
                      className="mr-3"
                    >
                      {isItemSelected(file, false) ? (
                        <CheckSquareIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  <div className="text-3xl mr-4">{getFileIcon(file.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{file.name}</h3>
                      {getVisibilityIcon(file.visibility)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.file_size_bytes)} · {formatDate(file.created_at)}
                    </p>
                  </div>
                  {!selectionMode && (
                    <div className="flex items-center gap-2">
                      {canPreview(file) && (
                        <button
                          onClick={() => openPreview(file)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                          title="Preview"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => downloadFile(file.id, file.name)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title={t('drive:files.download')}
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openRenameModal(file, false)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Rename"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openMoveModal(file, false)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Move"
                      >
                        <MoveIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openShareModal(file)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title={t('drive:share.title')}
                      >
                        <ShareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openVersionModal(file)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Versions"
                      >
                        <HistoryIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(file, false)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title={t('drive:files.delete')}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {folders.length === 0 && files.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>{t('drive:folders.empty')}</p>
                </div>
              )}
            </div>
          ) : (
            // Grid View
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="relative flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  {selectionMode && (
                    <button
                      onClick={() => toggleItemSelection(folder, true)}
                      className="absolute top-2 left-2"
                    >
                      {isItemSelected(folder, true) ? (
                        <CheckSquareIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  <div
                    className="cursor-pointer text-center"
                    onClick={() => !selectionMode && navigateToFolder(folder.id, folder.name)}
                  >
                    <FolderIcon className="w-16 h-16 text-blue-500 mb-2 mx-auto" />
                    <span className="text-sm font-medium text-gray-900 truncate w-full block">
                      {folder.name}
                    </span>
                    <span className="text-xs text-gray-500">{folder.file_count} {t('drive:files.title')}</span>
                  </div>
                </div>
              ))}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="relative flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  {selectionMode && (
                    <button
                      onClick={() => toggleItemSelection(file, false)}
                      className="absolute top-2 left-2"
                    >
                      {isItemSelected(file, false) ? (
                        <CheckSquareIcon className="w-5 h-5 text-blue-600" />
                      ) : (
                        <SquareIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}
                  <div
                    className="cursor-pointer text-center"
                    onClick={() => !selectionMode && canPreview(file) && openPreview(file)}
                  >
                    <div className="text-5xl mb-2">{getFileIcon(file.mime_type)}</div>
                    <span className="text-sm font-medium text-gray-900 truncate w-full block">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-500">{formatFileSize(file.file_size_bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Multi-File Upload Modal */}
      {uploadModalOpen && uploadQueue.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {t('drive:upload.uploading')} ({uploadQueue.filter(u => u.status === 'success').length}/{uploadQueue.length})
            </h2>
            <div className="space-y-3">
              {uploadQueue.map((upload) => (
                <div key={upload.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{upload.file.name}</span>
                    <span className="text-xs text-gray-500">
                      {upload.status === 'success' ? '✓ Done' :
                       upload.status === 'error' ? '✗ Failed' :
                       upload.status === 'uploading' ? `${upload.progress}%` :
                       'Waiting...'}
                    </span>
                  </div>
                  {(upload.status === 'uploading' || upload.status === 'pending') && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {folderModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('drive:folders.create')}</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('drive:folders.name')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFolderModalOpen(false);
                  setNewFolderName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {t('common:general.cancel')}
              </button>
              <button
                onClick={createFolder}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('common:general.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Rename</h2>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="New name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && renameItem()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRenameModalOpen(false);
                  setRenameName('');
                  setSelectedFile(null);
                  setSelectedFolder(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {t('common:general.cancel')}
              </button>
              <button
                onClick={renameItem}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Move to...</h2>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 mb-4">
              <button
                onClick={() => moveItem(null)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
              >
                📁 {t('drive:myDrive')}
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => moveItem(folder.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
                >
                  📁 {folder.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMoveModalOpen(false);
                setSelectedFile(null);
                setSelectedFolder(null);
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {t('common:general.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewModalOpen && previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{previewFile.name}</h2>
              <button
                onClick={() => {
                  setPreviewModalOpen(false);
                  setPreviewFile(null);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-4">
              {getPreviewContent(previewFile)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadFile(previewFile.id, previewFile.name)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <DownloadIcon className="w-4 h-4 inline mr-2" />
                Download
              </button>
              <button
                onClick={() => openShareModal(previewFile)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <ShareIcon className="w-4 h-4 inline mr-2" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Share Modal */}
      {shareModalOpen && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('drive:share.title')}</h2>
            <p className="text-gray-600 mb-4">{selectedFile.name}</p>

            {/* User Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Share with users:
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {allUsers.map((user) => (
                  <label key={user.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShareUsers([...shareUsers, user.id]);
                        } else {
                          setShareUsers(shareUsers.filter(id => id !== user.id));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{user.name || user.username} ({user.email})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={shareWithUsers}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={shareUsers.length === 0}
              >
                Share with selected users
              </button>
              <button
                onClick={createPublicLink}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('drive:share.createLink')}
              </button>
              <button
                onClick={() => {
                  setShareModalOpen(false);
                  setSelectedFile(null);
                  setShareUsers([]);
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {t('common:general.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {versionModalOpen && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Version History - {selectedFile.name}</h2>

            {fileVersions.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fileVersions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium">Version {version.version}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(version.created_at)} · {formatFileSize(version.file_size_bytes)}
                      </p>
                      {version.change_description && (
                        <p className="text-sm text-gray-600">{version.change_description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => restoreVersion(version.id)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No version history available</p>
            )}

            <button
              onClick={() => {
                setVersionModalOpen(false);
                setSelectedFile(null);
                setFileVersions([]);
              }}
              className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {t('common:general.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriveAdvanced;
