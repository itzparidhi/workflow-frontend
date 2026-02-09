import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DriveImage } from '../DriveImage';
import type { Shot, UserProfile } from '../../types';

interface ReferencePanelProps {
    shot: Shot;
    userProfile: UserProfile | null;
    uploadingRefs: {
        storyboard: boolean;
        composition: boolean;
        style: boolean;
        lighting: boolean;
    };
    openAccordion: string | null;
    toggleAccordion: (id: string) => void;
    handleReferenceUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'storyboard' | 'composition' | 'style' | 'lighting') => void;
    setFullScreenImage: (url: string | null) => void;
    setZoomLevel: (level: number) => void;
    navigate: (path: number) => void;
    isGenerating: boolean;
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
    shot,
    userProfile,
    uploadingRefs,
    openAccordion,
    toggleAccordion,
    handleReferenceUpload,
    setFullScreenImage,
    setZoomLevel,
    navigate,
    isGenerating,
}) => {
    const handleFullScreen = (url: string | null) => {
        if (url) {
            setFullScreenImage(url);
            setZoomLevel(1);
        }
    };

    return (
        <div className="w-full">
            <button onClick={() => navigate(-1)} className="mb-4 text-zinc-400 hover:text-white self-start">← Back</button>

            {/* Main Storyboard Reference */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">Storyboard Reference</h2>
                    {(userProfile?.role === 'CD' || userProfile?.role === 'PM') && (
                        <label className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded cursor-pointer border border-zinc-600">
                            {uploadingRefs.storyboard ? '...' : 'Upload'}
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleReferenceUpload(e, 'storyboard')}
                                disabled={uploadingRefs.storyboard}
                                accept="image/*"
                            />
                        </label>
                    )}
                </div>
                {shot.storyboard_url ? (
                    <div
                        className="w-full rounded border border-zinc-700 cursor-zoom-in overflow-hidden"
                        onClick={() => handleFullScreen(shot.storyboard_url)}
                    >
                        <DriveImage
                            src={shot.storyboard_url}
                            alt="Storyboard"
                            className="w-full"
                        />
                    </div>
                ) : (
                    <div className="aspect-video flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 border-dashed text-zinc-500">
                        No Storyboard
                    </div>
                )}
            </div>

            {/* References Accordions */}
            <div className="space-y-2 mb-1">
                {[
                    { id: 'composition', title: 'Composition Reference', url: shot.composition_url, loading: uploadingRefs.composition },
                    { id: 'style', title: 'Character Reference', url: shot.style_url, loading: uploadingRefs.style },
                    { id: 'lighting', title: 'Lighting Reference', url: shot.lighting_url, loading: uploadingRefs.lighting },
                ].map((ref) => (
                    <div key={ref.id} className="border border-zinc-700 rounded bg-zinc-800/30 overflow-hidden">
                        <button
                            onClick={() => toggleAccordion(ref.id)}
                            className="w-full flex items-center justify-between p-3 hover:bg-zinc-800 transition-colors"
                        >
                            <span className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                                {openAccordion === ref.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {ref.title}
                            </span>
                            {ref.url && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                        </button>

                        {openAccordion === ref.id && (
                            <div className="p-3 border-t border-zinc-700 bg-zinc-900/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase font-bold text-zinc-500">Reference Image</span>
                                    {(userProfile?.role === 'CD' || userProfile?.role === 'PM') && (
                                        <label className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded cursor-pointer border border-zinc-600">
                                            {ref.loading ? '...' : 'Upload'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => handleReferenceUpload(e, ref.id as any)}
                                                disabled={ref.loading || isGenerating}
                                                accept="image/*"
                                            />
                                        </label>
                                    )}
                                </div>

                                {ref.url ? (
                                    <div
                                        className="w-full rounded border border-zinc-700 cursor-zoom-in overflow-hidden"
                                        onClick={() => handleFullScreen(ref.url)}
                                    >
                                        <DriveImage src={ref.url} alt={ref.title} className="w-full" />
                                    </div>
                                ) : (
                                    <div className="aspect-video flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 border-dashed text-zinc-600 text-xs">
                                        No Reference
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Background References Accordion */}
            <div className="border border-zinc-700 rounded bg-zinc-800/30 overflow-hidden mb-6">
                <button
                    onClick={() => toggleAccordion('backgrounds')}
                    className="w-full flex items-center justify-between p-3 hover:bg-zinc-800 transition-colors"
                >
                    <span className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                        {openAccordion === 'backgrounds' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Background References
                    </span>
                    {shot.background_urls && shot.background_urls.length > 0 && (
                        <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                            {shot.background_urls.length}
                        </span>
                    )}
                </button>

                {openAccordion === 'backgrounds' && (
                    <div className="p-3 border-t border-zinc-700 bg-zinc-900/50">
                        {shot.background_urls && shot.background_urls.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {shot.background_urls.map((url, idx) => (
                                    <div
                                        key={idx}
                                        className="relative aspect-square rounded border border-zinc-700 cursor-zoom-in overflow-hidden group"
                                        onClick={() => setFullScreenImage(url)}
                                    >
                                        <img src={url} alt={`Background ${idx + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-zinc-600 text-xs italic">
                                No background references yet. <br /> Use "Background Grid" mode to generate some.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
