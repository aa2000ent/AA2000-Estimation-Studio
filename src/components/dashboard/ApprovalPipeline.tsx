import React, { useState } from 'react';

interface Project {
    id: string;
    name: string;
    client: string;
    submittedDate: string;
    amount: string;
    status: 'Pending' | 'In Progress' | 'Completed';
}

export default function ApprovalPipeline() {
    const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [projects] = useState<Project[]>([]);

    const filteredProjects = projects.filter((p) => {
        const matchesTab = activeTab === 'All' || p.status === activeTab;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.client.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section with Filter tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Approval Pipeline</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Review and manage project approvals submitted through the estimation workflow.
                    </p>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((tab) => {
                        const count = tab === 'All' ? projects.length : projects.filter(p => p.status === tab).length;
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${isActive
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {tab}
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-blue-700 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Container */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
                {/* Controls bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div>
                        <h2 className="text-xs font-bold tracking-wider text-gray-900 dark:text-white uppercase">
                            Approval Pipeline
                        </h2>
                        <p className="text-[11px] text-gray-400 font-semibold tracking-wider uppercase">
                            AA2000 SECURITY • ESTIMATION PLATFORM
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none">
                            <option>Newest</option>
                            <option>Oldest</option>
                        </select>
                    </div>
                </div>

                {/* Empty State View */}
                {filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                            No projects awaiting approval
                        </h3>
                        <p className="text-xs text-gray-400">
                            There are currently no projects requiring your review.
                        </p>
                    </div>
                ) : (
                    /* Active Projects List View */
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 my-4">
                        {filteredProjects.map((project) => (
                            <div key={project.id} className="py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</p>
                                    <p className="text-xs text-gray-400">{project.client} • {project.submittedDate}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{project.amount}</span>
                                    <button className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                                        Review
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating AI Estimator Button */}
            <div className="fixed bottom-6 right-6">
                <button className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full shadow-lg transition-transform active:scale-95">
                    <span>✨</span>
                    <span>AI Estimator</span>
                </button>
            </div>
        </div>
    );
}