import type { User } from '../../App';
import { getRoleTheme } from '../../utils/RoleTheme';
import { Check } from '../../utils/Icons';

interface Props {
  user: User;
  onComplete: () => void;
}

type RoleKey = 'ACCOUNTING' | 'PROCUREMENT' | 'ADMIN';

interface FlowStep {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const roleFlows: Record<RoleKey, { title: string; subtitle: string; color: string; steps: FlowStep[] }> = {
  ACCOUNTING: {
    title: 'Accounting & Finance Workflow',
    subtitle: 'Audit project estimations, fee breakdowns, and commercial margins',
    color: '#0D9488',
    steps: [
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>,
        title: 'Financial Dashboard',
        desc: 'Overview of total estimation values and pending approvals',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008Zm0-3h.008v.008h-.008v-.008ZM6.75 4.5h10.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6.75A1.5 1.5 0 0 1 5.25 18V6a1.5 1.5 0 0 1 1.5-1.5Zm1.5 3h7.5v1.5H8.25V7.5Z" /></svg>,
        title: 'Audit Cost Breakdown',
        desc: 'Audit manpower rates, logistical fees, and price tiers',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
        title: 'Review Approvals',
        desc: 'Validate pricing compliance and sign off on project estimates',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>,
        title: 'Export Quotations',
        desc: 'Generate audited commercial quotation sheets and PDF reports',
      },
    ],
  },
  PROCUREMENT: {
    title: 'Procurement & Sourcing Workflow',
    subtitle: 'Verify materials bill of quantities, manufacturer models, and supplier pricelists',
    color: '#D97706',
    steps: [
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>,
        title: 'Procurement Hub',
        desc: 'Track active projects with hardware and material requirements',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>,
        title: 'Review BOQ / BOM',
        desc: 'Inspect device quantities, mounting hardware, and cables',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /></svg>,
        title: 'Verify Pricelists',
        desc: 'Cross-reference carried distributor catalogues and pricing',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>,
        title: 'Export Requisition',
        desc: 'Export itemized hardware and materials requisition lists',
      },
    ],
  },
  ADMIN: {
    title: 'Administrator Workflow',
    subtitle: 'Oversee projects, teams, and approvals',
    color: '#4F46E5',
    steps: [
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>,
        title: 'Dashboard',
        desc: 'Full overview of all projects and team activity',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
        title: 'Create Project',
        desc: 'Set up new estimation projects with client info',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>,
        title: 'Assign Team',
        desc: 'Assign technicians and manage project resources',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>,
        title: 'Review Surveys',
        desc: 'Check completed survey submissions from field teams',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
        title: 'Approve Estimates',
        desc: 'Approve or reject final pricing and close out projects',
      },
      {
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
        title: 'Generate Reports',
        desc: 'Export project documentation and activity reports',
      },
    ],
  },
};

export default function InstructionScreen({ user, onComplete }: Props) {
  const roleKey = (user.role || 'ACCOUNTING') as RoleKey;
  const theme = getRoleTheme(roleKey);
  const flow = roleFlows[roleKey] || roleFlows.ACCOUNTING;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div
        className="w-full px-6 py-5 flex items-center justify-between"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black"
            style={{ background: theme.buttonGradient }}
          >
            {user.fullName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{user.fullName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.primary }}>
              {flow.title}
            </p>
          </div>
        </div>
        <button
          onClick={onComplete}
          className="py-2.5 px-5 rounded-xl text-xs font-bold text-white transition-all duration-200 btn-press"
          style={{
            background: theme.buttonGradient,
            boxShadow: `0 4px 14px ${theme.primary}35`,
          }}
        >
          Get Started
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center animate-fade-in-up">
          {/* Title section */}
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black text-slate-800 mb-2" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>
              Welcome to AA2000 Connect
            </h1>
            <p className="text-sm text-slate-500 font-medium">{flow.subtitle}</p>
          </div>

          {/* Flowchart */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 w-fit max-w-full">
            <div className="flex items-center justify-center gap-6">
              {flow.steps.map((step, i) => (
                <div key={step.title} className="flex items-center">
                  {/* Step card */}
                  <div className="flex flex-col items-center text-center group cursor-default">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                      style={{
                        background: `${theme.primary}10`,
                        color: theme.primary,
                        border: `2px solid ${theme.primary}20`,
                      }}
                    >
                      {step.icon}
                    </div>
                    <div
                      className="text-[10px] font-black uppercase tracking-wider mb-1 px-2 py-0.5 rounded-full"
                      style={{
                        background: `${theme.primary}08`,
                        color: theme.primaryDark,
                      }}
                    >
                      Step {i + 1}
                    </div>
                    <p className="text-xs font-bold text-slate-800 mb-0.5">{step.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium max-w-[130px] leading-tight">{step.desc}</p>
                  </div>

                  {/* Arrow connector */}
                  {i < flow.steps.length - 1 && (
                    <div className="flex items-center ml-6" style={{ color: `${theme.primary}30` }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl" style={{ background: `${theme.primary}06`, border: `1px solid ${theme.primary}12` }}>
            <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: theme.primary }} />
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              You can access this guide anytime from the settings menu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
