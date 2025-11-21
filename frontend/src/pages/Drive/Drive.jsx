// =====================================================
// Drive - File Management Interface
// =====================================================

import React, { useState, useEffect } from 'react';
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
  FilterIcon,
  PlusIcon,
  HomeIcon,
  ChevronRightIcon,
  EyeIcon,
  LockIcon,
  UsersIcon
} from 'lucide-react';
import api from '../../services/api';

function Drive() {
  const { t } = useTranslation();

  // State
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: t('drive:myDrive') }]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [filterType, setFilterType] = useState('all');

  // Upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Folder create state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Share state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Stats state
  const [stats, setStats] = useState(null);

  // Load folders and files
  useEffect(() => {
    loadContent();
    loadStats();
  }, [currentFolderId, sortBy, sortOrder, searchTerm]);

  const loadContent = async () => {
    setLoading(true);
    try {
      // Load folders
      const foldersRes = await api.get('/drive/folders', {
        params: { parentId: currentFolderId }
      });
      setFolders(foldersRes.data.data || []);

      // Load files
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

  // Navigate to folder
  const navigateToFolder = async (folderId, folderName) => {
    setCurrentFolderId(folderId);

    if (folderId === null) {
      setBreadcrumb([{ id: null, name: t('drive:myDrive') }]);
    } else {
      // Add to breadcrumb (simplified - real version would build full path)
      setBreadcrumb([...breadcrumb, { id: folderId, name: folderName }]);
    }
  };

  // Breadcrumb navigation
  const navigateToBreadcrumb = (index) => {
    const item = breadcrumb[index];
    setCurrentFolderId(item.id);
    setBreadcrumb(breadcrumb.slice(0, index + 1));
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

  // Upload file
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    if (currentFolderId) {
      formData.append('folderId', currentFolderId);
    }

    setUploading(true);
    try {
      await api.post('/drive/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setUploadModalOpen(false);
      setUploadProgress(0);
      loadContent();
      loadStats();
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.error || t('drive:errors.uploadFailed'));
    } finally {
      setUploading(false);
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

  // Delete file
  const deleteFile = async (fileId) => {
    if (!confirm(t('drive:delete.confirm'))) return;

    try {
      await api.delete(`/drive/files/${fileId}`);
      loadContent();
      loadStats();
    } catch (error) {
      console.error('Delete failed:', error);
      alert(t('drive:errors.deleteFailed'));
    }
  };

  // Share file
  const openShareModal = (file) => {
    setSelectedFile(file);
    setShareModalOpen(true);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get file icon by type
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

  // Get visibility icon
  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'private': return <LockIcon className="w-4 h-4 text-gray-500" />;
      case 'shared': return <UsersIcon className="w-4 h-4 text-blue-500" />;
      case 'public': return <EyeIcon className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6">
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
              className={`h-2 rounded-full ${
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
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            {t('drive:files.upload')}
          </button>

          <button
            onClick={() => setFolderModalOpen(true)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            {t('drive:folders.new')}
          </button>

          {/* Search */}
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

          {/* View Mode */}
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
                  className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                >
                  <FolderIcon className="w-10 h-10 text-blue-500 mr-4" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{folder.name}</h3>
                    <p className="text-sm text-gray-500">
                      {folder.file_count} {t('drive:files.title')} · {formatFileSize(folder.total_size_bytes)}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(folder.created_at)}
                  </div>
                </div>
              ))}

              {/* Files */}
              {files.map((file) => (
                <div key={file.id} className="flex items-center p-4 hover:bg-gray-50">
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadFile(file.id, file.name)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title={t('drive:files.download')}
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openShareModal(file)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title={t('drive:share.title')}
                    >
                      <ShareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title={t('drive:files.delete')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
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
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <FolderIcon className="w-16 h-16 text-blue-500 mb-2" />
                  <span className="text-sm text-center font-medium text-gray-900 truncate w-full">
                    {folder.name}
                  </span>
                  <span className="text-xs text-gray-500">{folder.file_count} {t('drive:files.title')}</span>
                </div>
              ))}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="text-5xl mb-2">{getFileIcon(file.mime_type)}</div>
                  <span className="text-sm text-center font-medium text-gray-900 truncate w-full">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500">{formatFileSize(file.file_size_bytes)}</span>
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => downloadFile(file.id, file.name)}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <DownloadIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('drive:upload.title')}</h2>

            {uploading ? (
              <div>
                <div className="mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-center">{uploadProgress}%</p>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      uploadFile(e.target.files[0]);
                    }
                  }}
                  className="w-full mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setUploadModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    {t('common:general.cancel')}
                  </button>
                </div>
              </div>
            )}
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

      {/* Share Modal */}
      {shareModalOpen && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('drive:share.title')}</h2>
            <p className="text-gray-600 mb-4">{selectedFile.name}</p>
            <button
              onClick={async () => {
                try {
                  const res = await api.post(`/drive/files/${selectedFile.id}/public-link`);
                  navigator.clipboard.writeText(res.data.data.url);
                  alert(t('drive:share.linkCopied'));
                  setShareModalOpen(false);
                } catch (error) {
                  alert(t('drive:errors.shareFailed'));
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-2"
            >
              {t('drive:share.createLink')}
            </button>
            <button
              onClick={() => setShareModalOpen(false)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {t('common:general.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drive;
