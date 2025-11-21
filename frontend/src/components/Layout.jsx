import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, FileText, Blocks, BookOpen, MapPin } from 'lucide-react';

function Layout() {
  const { t } = useTranslation();
  const location = useLocation();

  const navigation = [
    { name: t('pageBuilder.pages'), href: '/pages', icon: FileText },
    { name: 'Posts', href: '/posts', icon: BookOpen },
    { name: 'Locations', href: '/locations', icon: MapPin },
    { name: t('pageBuilder.modules'), href: '/modules', icon: Blocks }
  ];

  const isActive = (href) => location.pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <LayoutDashboard className="w-8 h-8 text-primary-600" />
            <span className="ml-3 text-xl font-bold">OpenIntraHub</span>
          </div>

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
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
