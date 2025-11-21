import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PagesList from './pages/PagesList';
import PageBuilder from './pages/PageBuilder';
import ModuleRegistry from './pages/ModuleRegistry';
import Login from './pages/Login';
import Setup from './pages/Setup/Setup';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Chat from './pages/Chat/Chat';
import PostsList from './pages/Posts/PostsList';
import PostEditor from './pages/Posts/PostEditor';
import CategoryManager from './pages/Posts/CategoryManager';
import TagManager from './pages/Posts/TagManager';
import LocationsList from './pages/Locations/LocationsList';
import LocationEditor from './pages/Locations/LocationEditor';
import EventsList from './pages/Events/EventsList';
import EventEditor from './pages/Events/EventEditor';
import EventDetails from './pages/Events/EventDetails';
import LDAPAdmin from './pages/Admin/LDAPAdmin';
import Drive from './pages/Drive/DriveAdvanced';
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
        <Route path="/setup" element={<Setup />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          {/* Dashboard (Home) */}
          <Route index element={<Dashboard />} />

          {/* Chat */}
          <Route path="chat" element={<Chat />} />

          {/* Drive */}
          <Route path="drive" element={<Drive />} />

          {/* Posts Routes */}
          <Route path="posts" element={<PostsList />} />
          <Route path="posts/new" element={<PostEditor />} />
          <Route path="posts/:id/edit" element={<PostEditor />} />
          <Route path="posts/categories" element={<CategoryManager />} />
          <Route path="posts/tags" element={<TagManager />} />

          {/* Events Routes */}
          <Route path="events" element={<EventsList />} />
          <Route path="events/new" element={<EventEditor />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="events/:id/edit" element={<EventEditor />} />

          {/* Locations Routes */}
          <Route path="locations" element={<LocationsList />} />
          <Route path="locations/new" element={<LocationEditor />} />
          <Route path="locations/:id/edit" element={<LocationEditor />} />

          {/* Page Builder Routes */}
          <Route path="pages" element={<PagesList />} />
          <Route path="pages/new" element={<PageBuilder />} />
          <Route path="pages/:id/edit" element={<PageBuilder />} />

          {/* Module Registry */}
          <Route path="modules" element={<ModuleRegistry />} />

          {/* Admin Routes */}
          <Route path="admin/ldap" element={<LDAPAdmin />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
