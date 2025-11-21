import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Blocks,
  BookOpen,
  MapPin,
  Calendar,
  MessageSquare,
  Home,
  User,
  Settings,
  LogOut,
  HardDrive
} from 'lucide-react';
import NotificationBell from './NotificationBell';

function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Drive', href: '/drive', icon: HardDrive },
    { name: 'Posts', href: '/posts', icon: BookOpen },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Locations', href: '/locations', icon: MapPin },
    { name: t('pageBuilder.pages'), href: '/pages', icon: FileText },
    { name: t('pageBuilder.modules'), href: '/modules', icon: Blocks }
  ];

  const isActive = (href) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
        <div className="flex items-center justify-between h-full px-6">
          {/* Logo */}
          <div className="flex items-center">
            <LayoutDashboard className="w-8 h-8 text-blue-600" />
            <span className="ml-3 text-xl font-bold text-gray-900">OpenIntraHub</span>
          </div>

          {/* Right Side - Notifications & User Menu */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <NotificationBell />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition"
              >
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.display_name || currentUser.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {(currentUser.display_name || currentUser.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 hidden md:block">
                  {currentUser.display_name || currentUser.username}
                </span>
                <svg className="w-4 h-4 text-gray-400 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">
                        {currentUser.display_name || currentUser.username}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {currentUser.email}
                      </p>
                    </div>
                    <div className="py-2">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profil
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Einstellungen
                      </Link>
                      {currentUser.role === 'admin' && (
                        <Link
                          to="/admin/ldap"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Settings className="w-4 h-4 mr-3" />
                          LDAP Admin
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-gray-200 py-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Abmelden
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 pt-16 z-30">
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="px-4 py-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                OpenIntraHub v0.1.1-alpha
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Open Source Intranet
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-16 pl-64">
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
