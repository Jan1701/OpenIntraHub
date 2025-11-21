import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash } from 'lucide-react';
import { pagesApi } from '../services/api';

function PagesList() {
  const { t } = useTranslation();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const response = await pagesApi.list();
      setPages(response.data.data);
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return;

    try {
      await pagesApi.delete(id);
      loadPages();
    } catch (error) {
      console.error('Error deleting page:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t('pageBuilder.pages')}</h1>
        <Link to="/pages/new" className="btn btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          {t('pageBuilder.createPage')}
        </Link>
      </div>

      <div className="grid gap-4">
        {pages.map((page) => (
          <div key={page.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{page.title}</h3>
                <p className="text-sm text-gray-500">/{page.slug}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    page.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {page.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/pages/${page.id}/edit`} className="btn btn-secondary">
                  <Edit className="w-4 h-4" />
                </Link>
                <button onClick={() => handleDelete(page.id)} className="btn btn-danger">
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PagesList;
