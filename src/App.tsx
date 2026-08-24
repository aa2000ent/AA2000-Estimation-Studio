import { useState, useCallback, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import ProjectDetail from './components/projects/ProjectDetail';
import SurveyWizard from './components/surveys/SurveyWizard';
import EstimationSummary from './components/estimation/EstimationSummary';
import Settings from './components/settings/Settings';
import CreateSurveyForm from './components/estimation/CreateSurveyForm';
import SurveySummary from './components/reports/SurveySummary';
import type { SurveyFormData } from './components/estimation/CreateSurveyForm';
import type { Notification } from './components/notifications/NotificationBell';
import { DEFAULT_TECHNICIANS } from './constants/roles';
import { ExclamationTriangle } from './utils/Icons';
import InstructionScreen from './components/auth/InstructionScreen';


export type Screen = 'login' | 'dashboard' | 'create-survey' | 'project-detail' | 'survey' | 'estimation' | 'settings' | 'notifications' | 'survey-summary' | 'instruction';
export type SurveyType = 'CCTV' | 'FIRE_ALARM' | 'FIRE_PROTECTION' | 'ACCESS_CONTROL' | 'BURGLAR_ALARM' | 'OTHER';

export interface User {
  id: string;
  fullName: string;
  email?: string;
  employeeId?: string;
  role?: 'TECHNICIAN' | 'ADMIN' | 'SALES' | 'MANAGER';
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
  aiScans: 'aa2000_ai_scans',
  instruction: 'aa2000_has_seen_instruction',
};

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
    
    // Migrate existing AI scans to add role property
    const aiScansRaw = localStorage.getItem(STORAGE_KEYS.aiScans);
    if (aiScansRaw) {
      try {
        const aiScans = JSON.parse(aiScansRaw) as AIScanGroup[];
        const needsMigration = aiScans.some(scan => 
          scan.files.some(file => !('role' in file))
        );
        
        if (needsMigration) {
          const migratedScans = aiScans.map(scan => ({
            ...scan,
            files: scan.files.map(file => ({
              ...file,
              role: (file as any).role || 'other'
            }))
          }));
          localStorage.setItem(STORAGE_KEYS.aiScans, JSON.stringify(migratedScans));
        }
      } catch (e) {
        console.error('Failed to migrate AI scans:', e);
      }
    }
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
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentSurveyType, setCurrentSurveyType] = useState<SurveyType | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage<Project[]>(STORAGE_KEYS.projects, []));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage<Notification[]>(STORAGE_KEYS.notifications, defaultNotifications));
  const [prefilledCompanyName, setPrefilledCompanyName] = useState<string>('');
  const [currentCompanyProject, setCurrentCompanyProject] = useState<Project | null>(null);
  const [aiScans, setAiScans] = useState<AIScanGroup[]>(() => loadFromStorage<AIScanGroup[]>(STORAGE_KEYS.aiScans, []));

  useEffect(() => {
    const saved = loadFromStorage<User | null>(STORAGE_KEYS.user, null);
    if (saved) {
      setUser(saved);
      const hasSeen = localStorage.getItem(STORAGE_KEYS.instruction);
      setScreen(hasSeen ? 'dashboard' : 'instruction');
    }
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.projects, projects);
  }, [projects]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.notifications, notifications);
  }, [notifications]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.user, user);
  }, [user]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.aiScans, aiScans);
  }, [aiScans]);

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

  const handleSaveAIScan = useCallback((scan: AIScanGroup) => {
    setAiScans(prev => [scan, ...prev]);
  }, []);

  const handleRenameAIScan = useCallback((id: string, name: string) => {
    setAiScans(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  const handleDeleteAIScan = useCallback((id: string) => {
    setAiScans(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleUpdateAIScan = useCallback((updatedScan: AIScanGroup) => {
    setAiScans(prev => prev.map(s => s.id === updatedScan.id ? updatedScan : s));
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

  const handleLogout = useCallback(() => {
    setUser(null);
    setCurrentProject(null);
    setScreen('login');
    localStorage.removeItem(STORAGE_KEYS.user);
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
    return <Login onLogin={handleLogin} />;
  }

  if (screen === 'create-survey') {
    const companyProject = prefilledCompanyName
      ? projects.find(p => p.buildingType === 'Other' && p.name === prefilledCompanyName)
      : undefined;

    return (
      <ErrorBoundary>
        <div className="min-h-screen flex">
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
        <div className="min-h-screen flex">
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
            contentOverride={
              <Settings user={user} onBack={handleBackFromSettings} onLogout={handleLogout} notifications={notifications} />
            }
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (screen === 'project-detail' && currentProject) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>
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
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>
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
            contentOverride={
              <SurveyWizard
                projectId={currentProject.id}
                surveyType={derivedSurveyType}
                onComplete={handleSurveyComplete}
                onBack={() => navigateToScreen('project-detail')}
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
        <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>
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
            contentOverride={
              <EstimationSummary
                project={currentProject}
                user={user}
                onBack={() => navigateToScreen('project-detail')}
                onUpdateStatus={handleUpdateProjectStatus}
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
        <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>
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
            contentOverride={
              <SurveySummary
                project={currentProject}
                user={user}
                onBack={handleGoBack}
                onViewEstimation={handleViewEstimation}
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
        <InstructionScreen
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
      />
    </ErrorBoundary>
  );
}
