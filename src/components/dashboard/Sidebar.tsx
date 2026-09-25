import React, { useState, useEffect } from 'react';
import {
  FileText,
  Settings,
  LogOut,
  Cpu,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Bot,
  X,
  Home,
  ListMinus,
  Users,
  Box,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { UserRole, type SessionUserProfile } from '../domain/models';
import { isTabUnderMaintenance } from '../shared/config/maintenanceConfig';

export type ActiveTab = 'dashboard' | 'manual-quotation' | 'quotation' | 'pipeline' | 'ai_quotation' | 'profile' | 'admin' | 'catalog' | 'template' | 'admin-automation' | 'app_review' | 'allyvirtual' | 'allyvirtual-contacts' | 'reports' | 'chats';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  userRole: UserRole;
  accountId: string;
  displayName: string;
  sessionProfile: SessionUserProfile | null;
  cartCount?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  show: boolean;
  isSubItem?: boolean;
  isParent?: boolean;
  parentId?: ActiveTab;
  dividerAfter?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
  userRole,
  accountId,
  displayName,
  sessionProfile,
  cartCount = 0,
  isDarkMode = false,
  onToggleDarkMode = () => {},
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Track single open accordion section ('admin' | 'allyvirtual' | null)
  const [openParentId, setOpenParentId] = useState<string | null>(() => {
    if (activeTab.startsWith('admin')) return 'admin';
    if (activeTab.startsWith('allyvirtual')) return 'allyvirtual';
    return null;
  });

  // Keep open parent section in sync if activeTab changes externally
  useEffect(() => {
    if (activeTab.startsWith('admin')) {
      setOpenParentId('admin');
    } else if (activeTab.startsWith('allyvirtual')) {
      setOpenParentId('allyvirtual');
    } else {
      setOpenParentId(null);
    }
  }, [activeTab]);

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const accountLabel =
    (displayName || '').trim() ||
    sessionProfile?.displayName ||
    (userRole === 'ADMIN' ? 'System Admin' : 'Sales Employee');

  const isAuthorizedAdmin = userRole === 'ADMIN' || userRole === 'SALES' || userRole === 'GENERAL MANAGER';
  const isAuthorizedAlly = userRole === 'ADMIN' || userRole === 'SALES' || userRole === 'GENERAL MANAGER';

  const navItems: NavItem[] = [
    // Quotation Options
    {id: 'dashboard',label: 'Dashboard', icon: Home, show: true,},
    {id: 'ai_quotation',label: 'AI Chat Quotation',icon: Bot,show: true,},
    {id: 'manual-quotation',label: 'Manual Quotation',icon: FileText,show: true,},
    {id: 'allyvirtual',label: 'AllyVirtual Quotation', icon: ListMinus ,show: isAuthorizedAlly,isParent: true,},
    {id: 'allyvirtual-contacts', label: 'Contacts',icon: UserCheck,show: isAuthorizedAlly,isSubItem: true,parentId: 'allyvirtual',},


    // Sales Options
    {id: 'pipeline',label: 'My Quotation',icon: FileText,show: true,},
    {id: 'template',label: 'Templates',icon: FileText,show: true,},
    {id: 'catalog',label: 'Products/Items',icon: Box,show: true,},
    {id: 'chats',label: 'Clients',icon: Users,show: isAuthorizedAlly,},
    {id: 'reports',label: 'Reports',icon: BarChart3,show: true,},

    //Settings
    {id: 'admin',label: 'Settings',icon: Settings,show: isAuthorizedAdmin,isParent: true,},
    {id: 'admin-automation',label: 'Automation Settings',icon: Cpu,show: isAuthorizedAdmin,isSubItem: true,parentId: 'admin',},
  ];

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // Normal mode: no active search query
    if (!q) {
      return navItems.filter((item) => {
        if (!item.show) return false;
        if (item.isSubItem && item.parentId) {
          return openParentId === item.parentId;
        }
        return true;
      });
    }

    // Search mode: matches sub-button label OR parent label OR child label
    return navItems.filter((item) => {
      if (!item.show) return false;

      // 1. Direct label match (e.g., searching "Catalog" matches "Catalog Management")
      if (item.label.toLowerCase().includes(q)) return true;

      // 2. Parent item matches if any of its authorized children match
      if (item.isParent) {
        const children = navItems.filter((child) => child.show && child.parentId === item.id);
        if (children.some((child) => child.label.toLowerCase().includes(q))) {
          return true;
        }
      }

      // 3. Sub-item matches if parent's label matches (e.g., searching "Admin" shows all admin sub-buttons)
      if (item.isSubItem && item.parentId) {
        const parent = navItems.find((p) => p.id === item.parentId);
        if (parent && parent.show && parent.label.toLowerCase().includes(q)) {
          return true;
        }
      }

      return false;
    });
  }, [navItems, searchQuery, activeTab, openParentId]);

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[999999] lg:relative lg:z-[60] bg-white border-r border-slate-100 shadow-sm transition-all duration-300 ease-in-out flex flex-col justify-between dark:bg-[#0F172A] dark:border-[#334155] ${
          sidebarOpen
            ? 'w-[270px] max-w-[85vw] lg:max-w-none lg:w-52 xl:w-64'
            : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full relative">
          {/* Header Section */}
          <div
            className={`p-3 sm:p-4 flex items-center border-b border-slate-100 relative min-h-[72px] dark:border-[#334155] ${
              sidebarOpen ? 'justify-between' : 'justify-center'
            }`}
          >
            <div className={`flex items-center gap-2 sm:gap-3 min-w-0 ${sidebarOpen ? 'flex-1' : 'justify-center w-full'}`}>
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600"
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <Bot className="h-5 w-5 text-white" />
              </button>

              {/* Title (Visible in Expanded Mode) */}
              {sidebarOpen && (
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-bold leading-snug text-slate-900 dark:text-[#F8FAFC]">
                    AI Chat
                    <br />
                    Quotation
                  </h1>
                </div>
              )}
            </div>

            {sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden ml-2 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100/80 text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer dark:bg-[#1E293B] dark:text-[#CBD5E1] dark:hover:bg-[#334155]"
                title="Close navigation menu"
                aria-label="Close navigation menu"
              >
                <X size={20} strokeWidth={2.25} />
              </button>
            )}
          </div>

          {/* Navigation Links List */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto sidebar-scrollbar">
            {filteredItems.map((item) => {
              const Icon = item.icon;

              let isActive = activeTab === item.id;
              let isParentActive = false;
              let isMiniActive = false;

              if (item.isParent && item.id === 'admin') {
                isParentActive = activeTab.startsWith('admin');
                isActive = isParentActive;
              } else if (item.isParent && item.id === 'allyvirtual') {
                isParentActive = activeTab.startsWith('allyvirtual');
                isActive = isParentActive;
              }

              if (item.id === 'allyvirtual-contacts' && activeTab === 'allyvirtual') {
                isActive = true;
                isMiniActive = true;
              } else if (item.isSubItem && activeTab === item.id) {
                isMiniActive = true;
                isActive = true;
              }

              const isMaintenance = isTabUnderMaintenance(item.id);

              const handleNavClick = () => {
                if (item.isParent) {
                  // Toggle this parent section, automatically closing all other parent sub-menus
                  setOpenParentId((prev) => (prev === item.id ? null : item.id));

                  if (item.id === 'admin' && !activeTab.startsWith('admin')) {
                    selectTab('admin-automation');
                  } else if (item.id === 'allyvirtual' && !activeTab.startsWith('allyvirtual')) {
                    selectTab('allyvirtual-contacts');
                  }
                } else {
                  if (item.isSubItem && item.parentId) {
                    setOpenParentId(item.parentId);
                  } else {
                    setOpenParentId(null);
                  }
                  selectTab(item.id);
                }
              };

              const isSectionExpanded = item.isParent && openParentId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isMaintenance}
                  onClick={handleNavClick}
                  title={!sidebarOpen ? `${item.label}${isMaintenance ? ' (Under Maintenance)' : ''}` : undefined}
                  className={`flex items-center gap-3 px-3 ${item.isSubItem ? 'py-1.5' : 'py-2.5 w-full'} rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isParentActive
                      ? 'bg-blue-50/80 text-blue-600 font-semibold text-xs'
                      : isMiniActive
                      ? 'bg-blue-50/80 text-blue-600 font-semibold text-[11px] border border-blue-100 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/80'
                      : isActive
                      ? 'bg-blue-50/80 text-blue-600 font-semibold text-xs'
                      : `text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium dark:text-[#CBD5E1] dark:hover:text-[#F8FAFC] dark:hover:bg-[#1E293B] ${item.isSubItem ? 'text-[11px]' : 'text-xs'}`
                  } ${!sidebarOpen ? 'justify-center px-0 w-full' : ''} ${item.isSubItem && sidebarOpen ? 'ml-8 w-[calc(100%-32px)] mt-0.5 mb-0.5' : ''}`}
                >
                  <div
                    className={`shrink-0 flex items-center justify-center relative ${
                      !sidebarOpen && isActive && !isMiniActive ? 'w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100' : ''
                    } ${!sidebarOpen && isMiniActive ? 'w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/80 mx-auto' : ''}`}
                  >
                    <Icon size={item.isSubItem ? 15 : 19} className={isParentActive ? 'text-blue-600' : isMiniActive ? 'text-blue-600 dark:text-blue-300' : isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700 dark:text-[#CBD5E1] dark:group-hover:text-[#F8FAFC]'} />
                    {isMaintenance && !sidebarOpen && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0F172A]" />
                    )}
                    {item.id === 'manual-quotation' && cartCount > 0 && !sidebarOpen && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white dark:ring-[#0F172A] shadow-xs">
                        {cartCount}
                      </span>
                    )}
                  </div>
                  {sidebarOpen && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {item.id === 'manual-quotation' && cartCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-600 text-white shadow-xs">
                          {cartCount}
                        </span>
                      )}
                      {item.isParent && !isMaintenance && (
                        isSectionExpanded ? (
                          <ChevronUp size={14} className={isParentActive ? 'text-blue-600' : 'text-slate-400 dark:text-[#CBD5E1]'} />
                        ) : (
                          <ChevronDown size={14} className={isParentActive ? 'text-blue-600' : 'text-slate-400 dark:text-[#CBD5E1]'} />
                        )
                      )}
                      {isMaintenance && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 uppercase tracking-tight shrink-0 border border-amber-200">
                          Unavailable
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Tip Card */}
          <div className="p-3 pt-2 border-t border-slate-100 dark:border-[#334155]">
            {sidebarOpen ? (
              <div className="rounded-2xl border border-blue-100/50 bg-blue-50/60 p-4 dark:bg-blue-950/30 dark:border-blue-900/40">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0" />
                  <span className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">Quick Tip</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-[#CBD5E1]">
                  Start with AI Chat Quotation for fast and intelligent quotation generation.
                </p>
                <button
                  type="button"
                  className="mt-3 block text-xs font-semibold text-blue-600 dark:text-blue-300 hover:underline focus:outline-none focus-visible:underline"
                >
                  Learn more →
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <div
                  className="w-10 h-10 rounded-xl bg-blue-50/60 border border-blue-100/50 flex items-center justify-center text-blue-600 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-300"
                  title="Start with AI Chat Quotation for fast and intelligent quotation generation."
                >
                  <Lightbulb className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;