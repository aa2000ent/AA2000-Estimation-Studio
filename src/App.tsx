import {
  restoreSessionToken,
  logout as logoutBackend,
} from './services/authService';
import {
  fetchEstimationProjects,
  mergeProjects,
  deleteEstimationProject,
} from './services/estimationProjects';
import {
  PROJECT_SUBMITTED_EVENT,
  isSubmittedToDb,
  sweepSubmittedProjects,
} from './services/estimationSubmission';

import { useState, useCallback, useEffect, Component } from 'react';
import { fetchAIScans, saveAIScan, updateAIScan, deleteAIScan } from './services/api/aiScans';
import type { ReactNode } from 'react';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/dashboard/DashboardPage';
import ProjectDetail from './pages/projects/ProjectDetailPage';
import InstructionPage from './pages/auth/InstructionPage';
import Settings from './components/settings/Settings';
import SurveyWizard from './components/surveys/SurveyWizard';
import EstimationSummary from './components/estimation/EstimationSummary';
import CreateSurveyForm from './components/estimation/CreateSurveyForm';
import SurveySummary from './components/reports/SurveySummary';
import type { SurveyFormData } from './components/estimation/CreateSurveyForm';
import type { Notification } from './components/notifications/NotificationBell';
import { DEFAULT_TECHNICIANS } from './constants/roles';
import { ExclamationTriangle } from './utils/Icons';


export type Screen = 'login' | 'dashboard' | 'create-survey' | 'project-detail' | 'survey' | 'estimation' | 'settings' | 'notifications' | 'survey-summary' | 'instruction';
export type SurveyType = 'CCTV' | 'FIRE_ALARM' | 'FIRE_PROTECTION' | 'ACCESS_CONTROL' | 'BURGLAR_ALARM' | 'OTHER';

export interface User {
  id: string;
  fullName: string;
  email?: string;
  employeeId?: string;
  role?: 'ACCOUNTING' | 'ADMIN' | 'TECHNICIAN';
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  location: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  buildingType?: string;
  floors?: number;
  buildingLength?: number;
  buildingWidth?: number;
  floorHeight?: number;
  systemTypes?: string[];   // e.g. ['CCTV', 'FDAS', 'ACCESS_CONTROL']
  surveyScope?: string;
  status: string;
  startDate?: string;
  assignedTechnicians: { id: string; fullName: string; email: string }[];
  technicianName?: string;
  /**
   * The `project_details.Proj_ID` this project came from, set only on projects
   * loaded from the database. It is what marks a row as DB-backed, which matters
   * because a DB project's status comes from the database and can be a
   * terminal one (APPROVED, COMPLETED) that the active-work views filter out.
   */
  dbProjId?: number;
  createdAt: string;
  isNewBuilding?: boolean;
  rooms?: number;
  totalFloorArea?: number;
}

export type FileRole = 'tor' | 'technician_proposal' | 'floor_plan' | 'other';

export interface AIScanFile {
  fileName: string;
  fileType: string;
  fileSizeLabel: string;
  parsedContent: string;   // truncated for storage
  aiResult: any;           // full AI JSON result
  role: FileRole;          // Role of this file in the audit context
}

export interface AIScanGroup {
  id: string;              // "scan-<timestamp>"
  name: string;            // user-editable folder name
  createdAt: string;       // ISO timestamp
  files: AIScanFile[];
}

const APP_VERSION = 'aa2000_v5';
const STORAGE_KEYS = {
  projects: 'aa2000_projects',
  notifications: 'aa2000_notifications',
  user: 'aa2000_user',
  instruction: 'aa2000_has_seen_instruction',
};

// AI scans are deliberately absent from STORAGE_KEYS. They used to be mirrored
// into localStorage under `aa2000_ai_scans`, which made every audit
// per-browser, shared between accounts on that browser, and destroyed by the
// version migration below. They are per-account rows on the backend now, so
// keeping the key would only resurrect stale per-browser copies that no longer
// match the server.

// Migrate / clear stale data from older app versions to prevent white screen crashes
(function migrateStorage() {
  try {
    const storedVersion = localStorage.getItem('aa2000_app_version');
    if (storedVersion !== APP_VERSION) {
      // Clear all old keys but preserve the version marker
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      localStorage.removeItem('aa2000_seeded');
      localStorage.removeItem('aa2000_pinned');
      localStorage.removeItem('aa2000_surveys');
      localStorage.setItem('aa2000_app_version', APP_VERSION);
    }

    // Drop any per-browser AI scans left behind by the localStorage era. They
    // were never scoped to an account, so they cannot be attributed to the
    // signed-in user and must not be uploaded as theirs.
    localStorage.removeItem('aa2000_ai_scans');
  } catch { }
})();

const defaultNotifications: Notification[] = [];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate that arrays are actually arrays and objects are objects
      if (parsed !== null && parsed !== undefined) {
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        return parsed;
      }
    }
  } catch { }
  return fallback;
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { }
}

function mapSystemToSurveyType(sys?: string): SurveyType | null {
  if (!sys) return null;
  if (sys === 'CCTV') return 'CCTV';
  if (sys === 'FDAS') return 'FIRE_ALARM';
  if (sys === 'ACCESS_CONTROL') return 'ACCESS_CONTROL';
  if (sys === 'BURGLAR_ALARM') return 'BURGLAR_ALARM';
  if (sys === 'FIRE_PROTECTION') return 'FIRE_PROTECTION';
  return 'OTHER';
}

// Error Boundary to catch any component crashes
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '24px', padding: '32px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <ExclamationTriangle className="w-8 h-8" style={{ marginBottom: '12px' }} />
            <h2 style={{ color: '#1E3A8A', fontWeight: 900, fontSize: '16px', marginBottom: '8px' }}>Something went wrong</h2>
            <p style={{ color: '#64748B', fontSize: '12px', marginBottom: '20px' }}>{this.state.error}</p>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 24px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              Clear & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentSurveyType, setCurrentSurveyType] = useState<SurveyType | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage<Project[]>(STORAGE_KEYS.projects, []));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage<Notification[]>(STORAGE_KEYS.notifications, defaultNotifications));
  const [prefilledCompanyName, setPrefilledCompanyName] = useState<string>('');
  const [currentCompanyProject, setCurrentCompanyProject] = useState<Project | null>(null);
  // Saved audits live on the backend, per account. Loaded once the session has
  // hydrated, because the request needs the session token the account carries.
  const [aiScans, setAiScans] = useState<AIScanGroup[]>([]);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const theme = localStorage.getItem('aa2000_theme');
      if (theme) return theme === 'dark';
      if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark');
      return false;
    } catch { return false; }
  });

  const toggleDark = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      try {
        if (next) {
          document.documentElement.classList.add('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem('aa2000_theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.setAttribute('data-theme', 'light');
          localStorage.setItem('aa2000_theme', 'light');
        }
      } catch {}
      return next;
    });
  }, []);

  // Keep isDark in sync when theme is toggled or updated in localStorage / DOM
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aa2000_theme') setIsDark(e.newValue === 'dark');
    };
    window.addEventListener('storage', onStorage);

    const checkDom = () => {
      try {
        const isThemeDark = localStorage.getItem('aa2000_theme') === 'dark' ||
          document.documentElement.classList.contains('dark');
        setIsDark(prev => (prev !== isThemeDark ? isThemeDark : prev));
      } catch {}
    };

    const interval = setInterval(checkDom, 400);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
  const token = restoreSessionToken();

  const saved = loadFromStorage<User | null>(
    STORAGE_KEYS.user,
    null
  );

  if (token && saved) {
    setUser(saved);

    const hasSeen = localStorage.getItem(
      STORAGE_KEYS.instruction
    );

    setScreen(
      hasSeen ? 'dashboard' : 'instruction'
    );
  } else {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.user);
    setScreen('login');
  }

  // Authentication restoration has finished.
  setAuthHydrated(true);
}, []);

  useEffect(() => {
    // Projects with a DB row are owned by the database: keep them out of localStorage.
    saveToStorage(
      STORAGE_KEYS.projects,
      projects.filter(p => !isSubmittedToDb(p.id)),
    );
  }, [projects]);

  // Clean up submissions made earlier (or in another tab): storage no longer holds them.
  useEffect(() => {
    const removed = sweepSubmittedProjects();
    if (removed.length) {
      setProjects(prev => prev.filter(p => !removed.includes(p.id)));
    }
  }, []);

  // A submit just succeeded in EstimationSummary: drop the local project and
  // immediately refresh from the DB so it reappears as a DB-backed entry.
  useEffect(() => {
    const onSubmitted = (event: Event) => {
      const projectId = (event as CustomEvent).detail?.projectId as string | undefined;
      if (!projectId) return;
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setCurrentProject(prev => (prev?.id === projectId ? null : prev));
      // Refresh from DB so the submitted project reappears with fresh data.
      fetchEstimationProjects()
        .then(remote => setProjects(prev => mergeProjects(prev, remote)))
        .catch(err => console.error('Failed to refresh after submit:', err));
    };
    window.addEventListener(PROJECT_SUBMITTED_EVENT, onSubmitted);
    return () => window.removeEventListener(PROJECT_SUBMITTED_EVENT, onSubmitted);
  }, []);

  // Load ESTIMATION projects from the database once signed in (DB status wins over local cache).
  useEffect(() => {
    if (!authHydrated || !user) return;
    let cancelled = false;
    fetchEstimationProjects()
      .then(remote => {
        if (!cancelled) setProjects(prev => mergeProjects(prev, remote));
      })
      .catch(err => console.error('Failed to load estimation projects from the database:', err));
    return () => { cancelled = true; };
  }, [authHydrated, user?.id]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.notifications, notifications);
  }, [notifications]);

  useEffect(() => {
  // Do not overwrite the saved user until
  // session restoration has finished.
  if (!authHydrated) {
    return;
  }

  if (user) {
    saveToStorage(STORAGE_KEYS.user, user);
  } else {
    localStorage.removeItem(STORAGE_KEYS.user);
  }
}, [user, authHydrated]);

  // Load this account's saved audits from the server. Not mirrored to
  // localStorage: the server is the only copy, so there is nothing to persist.
  useEffect(() => {
    if (!authHydrated || !user) {
      setAiScans([]);
      return;
    }

    let cancelled = false;
    fetchAIScans()
      .then(scans => { if (!cancelled) setAiScans(scans); })
      .catch(err => console.error('Failed to load saved AI scans:', err));
    return () => { cancelled = true; };
  }, [user, authHydrated]);

  // Sync notifications from projects automatically
  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const actualProjects = projects.filter(p => p.buildingType !== 'Other');

    setNotifications(prev => {
      const prevMap = new Map(prev.map(n => [n.id, n.read]));
      const newNotifs: Notification[] = [];

      actualProjects.forEach(project => {
        let type: 'ongoing' | 'upcoming' | 'missing' | 'approval' | 'finalize' | null = null;
        let title = '';

        const isCompleted = project.status === 'Completed' || project.status?.includes('Finalized');

        if (!isCompleted) {
          if (!project.startDate) {
            type = 'missing';
            title = `Missing Requirements: ${project.name}`;
          } else if (project.startDate > today) {
            type = 'upcoming';
            title = `Upcoming Survey: ${project.name}`;
          } else if (project.startDate === today) {
            type = 'ongoing';
            title = `Ongoing Survey: ${project.name}`;
          } else {
            type = 'missing';
            title = `Missing Requirements: ${project.name}`;
          }
        } else if (project.status === 'Finalized') {
          type = 'approval';
          title = `Awaiting Approval: ${project.name}`;
        } else if (project.status === 'Finalized - Approved' || project.status === 'Finalized - Rejected') {
          type = 'finalize';
          title = `Finalized Review: ${project.name}`;
        } else if (project.status === 'Completed') {
          type = 'finalize';
          title = `Survey Completed: ${project.name}`;
        }

        if (type) {
          const id = `notif-${project.id}-${type}`;
          newNotifs.push({
            id,
            title,
            companyName: project.clientName,
            date: project.startDate || project.createdAt.split('T')[0],
            read: prevMap.get(id) || false,
            type,
          });
        }
      });

      return newNotifs;
    });
  }, [projects]);

  const handleMarkNotificationsAsRead = useCallback((type: string) => {
    setNotifications(prev =>
      prev.map(n => (n.type === type || type === 'all') ? { ...n, read: true } : n)
    );
  }, []);

  // State is only updated once the server has accepted the change, so what the
  // user sees is what is actually stored. A failed write surfaces as a rejected
  // promise for the caller to report rather than silently diverging.
  const handleSaveAIScan = useCallback(async (scan: AIScanGroup) => {
    const saved = await saveAIScan(scan);
    setAiScans(prev => [saved, ...prev.filter(s => s.id !== saved.id)]);
  }, []);

  // The server keeps the stored files when the request carries none, so a rename
  // needs nothing but the id and the new name. Reading the current row out of
  // state first meant a rename on a folder that had not finished loading was a
  // silent no-op reported to the user as success.
  const handleRenameAIScan = useCallback(async (id: string, name: string) => {
    const saved = await updateAIScan({ id, name, createdAt: '', files: [] });
    setAiScans(prev => prev.map(s => (s.id === id ? saved : s)));
  }, []);

  const handleDeleteAIScan = useCallback(async (id: string) => {
    await deleteAIScan(id);
    setAiScans(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleUpdateAIScan = useCallback(async (updatedScan: AIScanGroup) => {
    const saved = await updateAIScan(updatedScan);
    setAiScans(prev => prev.map(s => (s.id === updatedScan.id ? saved : s)));
  }, []);



  const navigateToScreen = useCallback((newScreen: Screen) => {
    setScreen(prevScreen => {
      if (newScreen !== prevScreen) {
        // Don't track navigation from login
        if (prevScreen !== 'login') {
          setScreenHistory(prev => [...prev, prevScreen]);
        }
      }
      return newScreen;
    });
  }, []);

  const handleGoBack = useCallback(() => {
    setScreenHistory(prev => {
      if (prev.length === 0) {
        setScreen('dashboard');
        return prev;
      }
      const newHistory = [...prev];
      const prevScreen = newHistory.pop()!;
      setScreen(prevScreen);
      return newHistory;
    });
  }, []);

  const handleLogin = useCallback((u: User) => {
    setUser(u);
    const hasSeen = localStorage.getItem(STORAGE_KEYS.instruction);
    setScreen(hasSeen ? 'dashboard' : 'instruction');
  }, []);

  const handleLogout = useCallback(async () => {
  try {
    await logoutBackend();
  } catch (error) {
    console.error(
      'Backend logout failed:',
      error
    );
  } finally {
    setUser(null);
    setCurrentProject(null);
    setScreenHistory([]);
    setScreen('login');

    localStorage.removeItem(
      STORAGE_KEYS.user
    );
  }
}, []);

  const handleCreateProject = useCallback((project: Project) => {
    setProjects(prev => {
      const clean = (s?: string) => (s || '').trim().toLowerCase();
      const hasCompanyFolder = prev.some(
        p => p.buildingType === 'Other' && (clean(p.name) === clean(project.clientName) || clean(p.clientName) === clean(project.clientName))
      );
      const additional: Project[] = [];
      if (!hasCompanyFolder && project.buildingType !== 'Other' && project.clientName) {
        additional.push({
          id: `company-${Date.now()}`,
          name: project.clientName,
          clientName: project.clientContactName || project.clientName,
          clientEmail: project.clientEmail,
          clientPhone: project.clientPhone,
          location: project.location || '',
          buildingType: 'Other',
          status: 'Pending',
          systemTypes: project.systemTypes || [],
          assignedTechnicians: DEFAULT_TECHNICIANS,
          createdAt: new Date().toISOString(),
        });
      }
      return [...prev, ...additional, project];
    });
    setCurrentProject(project);
    navigateToScreen('project-detail');
  }, [navigateToScreen]);

  const handleSelectProject = useCallback((project: Project) => {
    setCurrentProject(project);
    navigateToScreen('project-detail');
  }, [navigateToScreen]);

  const handleStartSurvey = useCallback((type: SurveyType) => {
    setCurrentSurveyType(type);
    // Auto-advance to "In Progress" as soon as the surveyor starts any category
    if (currentProject && currentProject.status === 'Pending') {
      setProjects(prev =>
        prev.map(p => p.id === currentProject.id ? { ...p, status: 'In Progress' } : p)
      );
      setCurrentProject(prev => prev ? { ...prev, status: 'In Progress' } : null);
    }
    navigateToScreen('survey');
  }, [currentProject, navigateToScreen]);

  const handleSurveyComplete = useCallback(() => {
    if (currentProject) {
      setProjects(prev =>
        prev.map(p =>
          p.id === currentProject.id ? { ...p, status: p.status === 'Pending' ? 'In Progress' : p.status } : p
        )
      );
      setCurrentProject(prev => prev ? { ...prev, status: prev.status === 'Pending' ? 'In Progress' : prev.status } : null);
    }
    navigateToScreen('project-detail');
  }, [currentProject, navigateToScreen]);

  const handleUpdateProjectStatus = useCallback((projectId: string, status: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId ? { ...p, status } : p
      )
    );
    setCurrentProject(prev => prev && prev.id === projectId ? { ...prev, status } : prev);
  }, []);

  const handleUpdateProject = useCallback((updatedProject: Project) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === updatedProject.id ? updatedProject : p
      )
    );
    setCurrentProject(prev => prev && prev.id === updatedProject.id ? updatedProject : prev);
  }, []);

  const handleViewEstimation = useCallback(() => {
    navigateToScreen('estimation');
  }, [navigateToScreen]);

  const handleDeleteProject = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    // Remove the database row too (no-op for projects that were never submitted).
    deleteEstimationProject(projectId).then(r => {
      if (!r.success) console.error('Database delete failed; project may reappear on next load:', r.message);
    });
    setCurrentProject(null);
    try {
      const surveys = JSON.parse(localStorage.getItem('aa2000_surveys') || '[]');
      const remaining = surveys.filter((s: any) => s.projectId !== projectId);
      localStorage.setItem('aa2000_surveys', JSON.stringify(remaining));
    } catch (e) {
      console.error('Failed to clean up surveys on deletion', e);
    }
    try {
      localStorage.removeItem(`aa2000_estimation_${projectId}`);
    } catch (e) {
      console.error('Failed to clean up estimation on deletion', e);
    }
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setCurrentProject(null);
    handleGoBack();
  }, [handleGoBack]);

  const handleSettings = useCallback(() => {
    navigateToScreen('settings');
  }, [navigateToScreen]);

  const handleBackFromSettings = useCallback(() => {
    handleGoBack();
  }, [handleGoBack]);

  const handleNavigateToCreate = useCallback((companyName?: any) => {
    const nameStr = typeof companyName === 'object' && companyName !== null
      ? companyName.name || ''
      : String(companyName || '');
    setPrefilledCompanyName(nameStr);
    navigateToScreen('create-survey');
  }, [navigateToScreen]);

  const handleSaveSurvey = useCallback((data: SurveyFormData) => {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: `project-${Date.now()}`,
      name: data.projectName,
      clientName: data.companyName,
      clientContactName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientContactNumber,
      location: data.locationName,
      locationName: data.locationName,
      latitude: data.latitude,
      longitude: data.longitude,
      buildingType: data.buildingType,
      floors: data.floors || undefined,
      buildingLength: data.buildingLength || undefined,
      buildingWidth: data.buildingWidth || undefined,
      floorHeight: data.floorHeight || undefined,
      systemTypes: data.systemTypes,
      surveyScope: data.surveyScope,
      status: 'Pending',
      startDate: data.startDate,
      assignedTechnicians: DEFAULT_TECHNICIANS,
      createdAt: now,
    };

    setPrefilledCompanyName('');

    setProjects(prev => {
      const clean = (s?: string) => (s || '').trim().toLowerCase();
      const hasCompanyFolder = prev.some(
        p => p.buildingType === 'Other' && (clean(p.name) === clean(data.companyName) || clean(p.clientName) === clean(data.companyName))
      );

      const additionalProjects: Project[] = [];
      if (!hasCompanyFolder && data.companyName) {
        const newCompanyFolder: Project = {
          id: `company-${Date.now()}`,
          name: data.companyName,
          clientName: data.clientName || data.companyName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientContactNumber,
          location: data.locationName,
          buildingType: 'Other',
          status: 'Pending',
          systemTypes: data.systemTypes || [],
          assignedTechnicians: DEFAULT_TECHNICIANS,
          createdAt: now,
        };
        additionalProjects.push(newCompanyFolder);
      }

      return [...prev, ...additionalProjects, newProject];
    });

    setCurrentProject(newProject);

    const targetSurveyType = data.systemTypes && data.systemTypes.length > 0
      ? mapSystemToSurveyType(data.systemTypes[0])
      : null;

    if (targetSurveyType) {
      setCurrentSurveyType(targetSurveyType);
      navigateToScreen('survey');
    } else {
      setCurrentSurveyType(null);
      navigateToScreen('project-detail');
    }
  }, [navigateToScreen]);

  const handleExitCreateSurvey = useCallback(() => {
    setPrefilledCompanyName('');
    handleGoBack();
  }, [handleGoBack]);

  // Always fall back to login if user is not authenticated
  if (!user || screen === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (screen === 'create-survey') {
    const companyProject = prefilledCompanyName
      ? projects.find(p => p.buildingType === 'Other' && p.name === prefilledCompanyName)
      : undefined;

    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: isDark ? '#0B0F19' : '#F8FAFC' }}>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            activeViewOverride="create-survey"
            onExitOverride={handleExitCreateSurvey}
            contentOverride={
              <CreateSurveyForm
                userRole={user.role}
                onSave={handleSaveSurvey}
                onExit={handleExitCreateSurvey}
                initialCompanyName={prefilledCompanyName}
                initialLocationName={companyProject?.location}
                initialLatitude={companyProject?.latitude}
                initialLongitude={companyProject?.longitude}
                initialClientName={companyProject?.clientName}
                initialClientEmail={companyProject?.clientEmail}
                initialClientContactNumber={companyProject?.clientPhone}
                initialSystemTypes={companyProject?.systemTypes as any}
                isDark={isDark}
              />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'settings') {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: isDark ? '#0B0F19' : '#F8FAFC' }}>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            onExitOverride={handleBackFromSettings}
            isDark={isDark}
            onToggleDark={toggleDark}
            contentOverride={
              <Settings user={user} onBack={handleBackFromSettings} onLogout={handleLogout} notifications={notifications} isDark={isDark} />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'project-detail' && currentProject) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: isDark ? '#0B0F19' : '#F8FAFC' }}>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            onExitOverride={handleBackToDashboard}
            isDark={isDark}
            onToggleDark={toggleDark}
            contentOverride={
              <ProjectDetail
                user={user}
                project={currentProject}
                onBack={handleBackToDashboard}
                onStartSurvey={handleStartSurvey}
                onViewEstimation={handleViewEstimation}
                onViewSurveySummary={() => navigateToScreen('survey-summary')}
                onUpdateStatus={handleUpdateProjectStatus}
                onUpdateProject={handleUpdateProject}
                isDark={isDark}
              />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'survey') {
    const derivedSurveyType = currentSurveyType
      ?? (currentProject ? mapSystemToSurveyType(currentProject.systemTypes?.[0]) : null);

    if (!currentProject || !derivedSurveyType) {
      return (
        <ErrorBoundary>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            isDark={isDark}
            onToggleDark={toggleDark}
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: isDark ? '#0B0F19' : '#F8FAFC' }}>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            onExitOverride={handleBackToDashboard}
            isDark={isDark}
            onToggleDark={toggleDark}
            contentOverride={
              <SurveyWizard
                projectId={currentProject.id}
                surveyType={derivedSurveyType}
                onComplete={handleSurveyComplete}
                onBack={() => navigateToScreen('project-detail')}
                isDark={isDark}
              />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'estimation' && currentProject) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: isDark ? '#0B0F19' : '#F8FAFC' }}>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            onExitOverride={handleBackToDashboard}
            isDark={isDark}
            onToggleDark={toggleDark}
            contentOverride={
              <EstimationSummary
                project={currentProject}
                user={user}
                onBack={() => navigateToScreen('project-detail')}
                onUpdateStatus={handleUpdateProjectStatus}
                isDark={isDark}
              />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'survey-summary' && currentProject) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: isDark ? '#0B0F19' : '#F8FAFC' }}>
          <Dashboard
            user={user}
            onLogout={handleLogout}
            projects={projects}
            notifications={notifications}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onSettings={handleSettings}
            onNavigateToCreate={handleNavigateToCreate}
            selectedCompanyProject={currentCompanyProject}
            setSelectedCompanyProject={setCurrentCompanyProject}
            onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
            onExitOverride={handleGoBack}
            isDark={isDark}
            onToggleDark={toggleDark}
            contentOverride={
              <SurveySummary
                project={currentProject}
                user={user}
                onBack={handleGoBack}
                onViewEstimation={handleViewEstimation}
                isDark={isDark}
              />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'instruction') {
    return (
      <ErrorBoundary>
        <InstructionPage
          user={user}
          onComplete={() => {
            localStorage.setItem(STORAGE_KEYS.instruction, 'true');
            setScreen('dashboard');
          }}
        />
      </ErrorBoundary>
    );
  }

  // Default: dashboard
  return (
    <ErrorBoundary>
      <Dashboard
        user={user}
        onLogout={handleLogout}
        projects={projects}
        notifications={notifications}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onSettings={handleSettings}
        onNavigateToCreate={handleNavigateToCreate}
        selectedCompanyProject={currentCompanyProject}
        setSelectedCompanyProject={setCurrentCompanyProject}
        onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
        onDeleteProject={handleDeleteProject}
        onUpdateProject={handleUpdateProject}
        aiScans={aiScans}
        onSaveAIScan={handleSaveAIScan}
        onRenameAIScan={handleRenameAIScan}
        onDeleteAIScan={handleDeleteAIScan}
        onUpdateAIScan={handleUpdateAIScan}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
    </ErrorBoundary>
  );
}
