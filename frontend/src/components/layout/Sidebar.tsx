import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, FolderOpen, ListTodo, Settings, Layers, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = [
    { path: '/', icon: Home, label: t('nav.dashboard') },
    { path: '/files', icon: FolderOpen, label: t('nav.files') },
    { path: '/jobs', icon: ListTodo, label: t('nav.jobs') },
    { path: '/presets', icon: Layers, label: t('nav.presets') },
    { path: '/settings', icon: Settings, label: t('nav.settings') }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className='lg:hidden fixed inset-0 bg-black/50 z-40'
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 bg-dark-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className='flex flex-col h-full'>
          <div className='p-6 border-b border-dark-700'>
            <div className='flex items-center space-x-3'>
              <div className='w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden'>
                <img
                  src='logo.png'
                  alt={t('app.fullName', 'HandBrake Web UI')}
                  className='w-full h-full object-contain'
                />
              </div>
              <div>
                <h1 className='text-xl font-bold text-white'>{t('app.name', 'HandBrake')}</h1>
                <p className='text-xs text-gray-400'>{t('app.webUI', 'Web UI')}</p>
              </div>
            </div>
          </div>

          <nav
            className='flex-1 p-4 space-y-1'
            aria-label={t('nav.mainNavigation', 'Main navigation')}
          >
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-dark-700 hover:text-white'
                  )
                }
              >
                <item.icon className='w-5 h-5' />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className='p-4 border-t border-dark-700 space-y-3'>
            <div className='relative' ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className='flex items-center space-x-2 w-full'
                aria-label={t('nav.userMenu', 'User menu')}
                aria-expanded={showUserMenu}
              >
                <div className='w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center'>
                  <span className='text-primary text-sm font-medium'>
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className='min-w-0 text-left'>
                  <p className='text-sm font-medium text-white truncate'>{user?.username}</p>
                  <p className='text-xs text-gray-400 truncate'>{user?.role}</p>
                </div>
              </button>

              {showUserMenu && (
                <div className='absolute bottom-full left-0 right-0 mb-2 bg-dark-700 rounded-lg border border-dark-600 shadow-lg overflow-hidden'>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/account');
                    }}
                    className='flex items-center space-x-2 w-full px-4 py-3 text-gray-300 hover:bg-dark-600 hover:text-white transition-colors'
                  >
                    <User className='w-4 h-4' />
                    <span className='text-sm'>{t('settings.account')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className='flex items-center space-x-2 w-full px-4 py-3 text-gray-300 hover:bg-dark-600 hover:text-white transition-colors border-t border-dark-600'
                  >
                    <LogOut className='w-4 h-4' />
                    <span className='text-sm'>{t('nav.logout')}</span>
                  </button>
                </div>
              )}
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
