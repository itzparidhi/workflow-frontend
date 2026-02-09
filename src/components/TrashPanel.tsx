import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Project } from '../types';
import { Trash2, RotateCcw, Clock } from 'lucide-react';
import { restoreProject } from '../api';

interface TrashPanelProps {
    onProjectRestored?: () => void;
}

export const TrashPanel: React.FC<TrashPanelProps> = ({ onProjectRestored }) => {
    const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState<string | null>(null);

    useEffect(() => {
        fetchDeletedProjects();
    }, []);

    const fetchDeletedProjects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('is_deleted', true)
                .order('deleted_at', { ascending: false });

            if (error) throw error;
            setDeletedProjects(data || []);
        } catch (err) {
            console.error('Error fetching deleted projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (projectId: string) => {
        setRestoring(projectId);
        try {
            await restoreProject(projectId);
            // Remove from list
            setDeletedProjects(prev => prev.filter(p => p.id !== projectId));
            // Notify parent to refresh projects list
            if (onProjectRestored) onProjectRestored();
        } catch (err: any) {
            console.error('Failed to restore project:', err);
            alert(err.response?.data?.detail || 'Failed to restore project');
        } finally {
            setRestoring(null);
        }
    };

    const getDaysRemaining = (deletedAt: string | undefined) => {
        if (!deletedAt) return 30;
        const deletedDate = new Date(deletedAt);
        const now = new Date();
        const diffTime = now.getTime() - deletedDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, 30 - diffDays);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Trash2 className="text-red-500" size={28} />
                <div>
                    <h2 className="text-2xl font-bold text-white">Trash</h2>
                    <p className="text-sm text-zinc-400">Deleted projects are permanently removed after 30 days</p>
                </div>
            </div>

            {deletedProjects.length === 0 ? (
                <div className="text-center py-16">
                    <Trash2 className="mx-auto text-zinc-600 mb-4" size={48} />
                    <p className="text-zinc-500 text-lg">Trash is empty</p>
                    <p className="text-zinc-600 text-sm mt-1">Deleted projects will appear here</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deletedProjects.map(project => {
                        const daysRemaining = getDaysRemaining(project.deleted_at);
                        const isRestoring = restoring === project.id;

                        return (
                            <div
                                key={project.id}
                                className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-zinc-600 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-semibold text-white text-lg truncate flex-1 mr-2">
                                        {project.name}
                                    </h3>
                                    <button
                                        onClick={() => handleRestore(project.id)}
                                        disabled={isRestoring}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 hover:text-green-300 transition-all text-sm font-medium disabled:opacity-50"
                                    >
                                        {isRestoring ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-400"></div>
                                        ) : (
                                            <RotateCcw size={14} />
                                        )}
                                        Restore
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        <span>
                                            Deleted: {project.deleted_at
                                                ? new Date(project.deleted_at).toLocaleDateString()
                                                : 'Unknown'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-zinc-700/50">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className={`font-medium ${daysRemaining <= 7 ? 'text-red-400' : 'text-zinc-400'}`}>
                                            {daysRemaining} days remaining
                                        </span>
                                        <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${daysRemaining <= 7 ? 'bg-red-500' : 'bg-zinc-500'}`}
                                                style={{ width: `${(daysRemaining / 30) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
