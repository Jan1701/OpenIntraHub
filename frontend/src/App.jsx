import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PagesList from './pages/PagesList';
import PageBuilder from './pages/PageBuilder';
import ModuleRegistry from './pages/ModuleRegistry';
import Login from './pages/Login';
import Layout from './components/Layout';
import PostsList from './pages/Posts/PostsList';
import PostEditor from './pages/Posts/PostEditor';
import CategoryManager from './pages/Posts/CategoryManager';
import TagManager from './pages/Posts/TagManager';
import LocationsList from './pages/Locations/LocationsList';
import LocationEditor from './pages/Locations/LocationEditor';
import './styles/index.css';

function App() {
  const { i18n } = useTranslation();

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!localStorage.getItem('token');
  };

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    return isAuthenticated() ? children : <Navigate to="/login" replace />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/pages" replace />} />
          <Route path="pages" element={<PagesList />} />
          <Route path="pages/new" element={<PageBuilder />} />
          <Route path="pages/:id/edit" element={<PageBuilder />} />
          <Route path="modules" element={<ModuleRegistry />} />

          {/* Posts Routes */}
          <Route path="posts" element={<PostsList />} />
          <Route path="posts/new" element={<PostEditor />} />
          <Route path="posts/:id/edit" element={<PostEditor />} />
          <Route path="posts/categories" element={<CategoryManager />} />
          <Route path="posts/tags" element={<TagManager />} />

          {/* Locations Routes */}
          <Route path="locations" element={<LocationsList />} />
          <Route path="locations/new" element={<LocationEditor />} />
          <Route path="locations/:id/edit" element={<LocationEditor />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
