import React, { useState, useRef } from 'react';
import { NotificationBell } from '../NotificationBell';
import type { Version, Review, UserProfile } from '../../types';
import { Image as ImageIcon, X, Maximize2 } from 'lucide-react';
import { ImageViewerModal } from '../ImageViewerModal';

interface FeedbackPanelProps {
    activeVersion: Version | null;
    review: Review | null;
    userProfile: UserProfile | null;
    handleVote: (type: 'pm' | 'cd', vote: boolean) => void;
    handleCommentSave: (type: 'pm' | 'cd', file?: File) => void;
    pmCommentRef: React.RefObject<HTMLTextAreaElement | null>;
    cdCommentRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
    activeVersion,
    review,
    userProfile,
    handleVote,
    handleCommentSave,
    pmCommentRef,
    cdCommentRef,
}) => {
    const [pmFile, setPmFile] = useState<File | null>(null);
    const [cdFile, setCdFile] = useState<File | null>(null);
    const pmFileInputRef = useRef<HTMLInputElement>(null);
    const cdFileInputRef = useRef<HTMLInputElement>(null);

    const [viewImage, setViewImage] = useState<{ url: string, prompt?: string } | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'pm' | 'cd') => {
        if (e.target.files && e.target.files[0]) {
            if (type === 'pm') setPmFile(e.target.files[0]);
            else setCdFile(e.target.files[0]);
        }
    };

    const clearFile = (type: 'pm' | 'cd') => {
        if (type === 'pm') {
            setPmFile(null);
            if (pmFileInputRef.current) pmFileInputRef.current.value = '';
        } else {
            setCdFile(null);
            if (cdFileInputRef.current) cdFileInputRef.current.value = '';
        }
    };

    return (
        <>
            <div className="w-1/4 p-4 bg-zinc-800 flex flex-col overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Feedback</h2>
                    <NotificationBell />
                </div>

                {activeVersion && review ? (
                    <div className="space-y-6">
                        {/* PM Card */}
                        <div className="p-4 bg-zinc-900 rounded border border-zinc-700">
                            <h3 className="font-bold mb-2 text-zinc-300">Project Manager</h3>
                            <div className="flex space-x-2 mb-4">
                                <button
                                    disabled={userProfile?.role !== 'PM'}
                                    onClick={() => handleVote('pm', true)}
                                    className={`flex-1 py-2 rounded-full border-2 font-bold transition-all ${review.pm_vote === true ? 'border-green-500 bg-green-500/20 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500'}`}
                                >
                                    YES
                                </button>
                                <button
                                    disabled={userProfile?.role !== 'PM'}
                                    onClick={() => handleVote('pm', false)}
                                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${review.pm_vote === false ? 'bg-red-600/80 text-white shadow-lg' : 'bg-black/20 text-zinc-500 hover:bg-white/5 border border-white/5'}`}
                                >
                                    NO
                                </button>
                            </div>
                            {/* Approval status and email */}
                            {review.pm_vote !== null && (
                                <div className="mb-3 text-xs flex justify-between items-center  p-2 rounded-lg">
                                    <span className={review.pm_vote ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                        {review.pm_vote ? 'Approved' : 'Rejected'} by PM
                                    </span>
                                    {activeVersion?.users?.email && (
                                        <span className="text-zinc-500 font-mono text-[10px] truncate max-w-[100px]" title={activeVersion.users.email}>
                                            {activeVersion.users.email.split('@')[0]}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="border-t border-white/10 pt-4">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest">Review Notes</h4>
                                <textarea
                                    key={`pm-${review.id}`}
                                    ref={pmCommentRef}
                                    defaultValue={review.pm_comment || ''}
                                    className="w-full bg-black/40 text-zinc-200 p-3 rounded-lg border border-white/10 mb-2 min-h-24 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-y"
                                    placeholder={userProfile?.role === 'PM' ? "Write review..." : "No review yet."}
                                    disabled={userProfile?.role !== 'PM'}
                                />

                                {/* PM Image Attachment */}
                                {(userProfile?.role === 'PM' || review.pm_image_url) && (
                                    <div className="mb-3">
                                        {userProfile?.role === 'PM' && (
                                            <div className="flex items-center justify-between mb-2">
                                                <button
                                                    onClick={() => pmFileInputRef.current?.click()}
                                                    className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <ImageIcon size={12} /> Attach Image
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={pmFileInputRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileSelect(e, 'pm')}
                                                />
                                            </div>
                                        )}

                                        {/* Preview / Existing Image */}
                                        {(pmFile || review.pm_image_url) && (
                                            <div className="relative group w-24 h-24 bg-black/50 rounded-lg overflow-hidden border border-white/10">
                                                <img
                                                    src={pmFile ? URL.createObjectURL(pmFile) : review.pm_image_url!}
                                                    alt="Review attachment"
                                                    className="w-full h-full object-cover"
                                                />
                                                {/* Actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setViewImage({ url: pmFile ? URL.createObjectURL(pmFile) : review.pm_image_url!, prompt: 'PM Review Attachment' })}
                                                        className="p-1.5 bg-zinc-800 text-white rounded-full hover:bg-zinc-700"
                                                        title="View Full"
                                                    >
                                                        <Maximize2 size={12} />
                                                    </button>
                                                    {userProfile?.role === 'PM' && pmFile && (
                                                        <button
                                                            onClick={() => clearFile('pm')}
                                                            className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                                            title="Remove Upload"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {userProfile?.role === 'PM' && (
                                    <button
                                        onClick={() => handleCommentSave('pm', pmFile || undefined)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-sm font-bold  border-white-500 bg-white-900/20 text-white "
                                    >
                                        Save Review
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* CD Card */}
                        <div className="p-4 bg-zinc-900 rounded border border-zinc-700">
                            <h3 className="font-bold mb-2 text-zinc-300">Creative Director</h3>
                            <div className="flex space-x-2 mb-4">
                                <button
                                    disabled={userProfile?.role !== 'CD'}
                                    onClick={() => handleVote('cd', true)}
                                    className={`flex-1 py-2 rounded-full border-2 font-bold transition-all ${review.cd_vote === true ? 'border-green-500 bg-green-500/20 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500'}`}
                                >
                                    YES
                                </button>
                                <button
                                    disabled={userProfile?.role !== 'CD'}
                                    onClick={() => handleVote('cd', false)}
                                    className={`flex-1 py-2 rounded-full border-2 font-bold transition-all ${review.cd_vote === false ? 'border-red-500 bg-red-500/20 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500'}`}
                                >
                                    NO
                                </button>
                            </div>
                            {/* Approval status and email */}
                            {review.cd_vote !== null && (
                                <div className="mb-1 text-xs flex justify-between items-center bg-black/0 p-2 rounded-lg">
                                    <span className={review.cd_vote ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                        {review.cd_vote ? 'Approved' : 'Rejected'} by CD
                                    </span>
                                    {activeVersion?.users?.email && (
                                        <span className="text-zinc-500 font-mono text-[10px] truncate max-w-[100px]" title={activeVersion.users.email}>
                                            {activeVersion.users.email.split('@')[0]}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="border-t border-white/10 pt-4">
                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest">Review Notes</h4>
                                <textarea
                                    key={`cd-${review.id}`}
                                    ref={cdCommentRef}
                                    defaultValue={review.cd_comment || ''}
                                    className="w-full bg-black/40 text-zinc-200 p-3 rounded-lg border border-white/10 mb-3 min-h-24 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-y"
                                    placeholder={userProfile?.role === 'CD' ? "Write review..." : "No review yet."}
                                    disabled={userProfile?.role !== 'CD'}
                                />

                                {/* CD Image Attachment */}
                                {(userProfile?.role === 'CD' || review.cd_image_url) && (
                                    <div className="mb-3">
                                        {userProfile?.role === 'CD' && (
                                            <div className="flex items-center justify-between mb-2">
                                                <button
                                                    onClick={() => cdFileInputRef.current?.click()}
                                                    className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <ImageIcon size={12} /> Attach Image
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={cdFileInputRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileSelect(e, 'cd')}
                                                />
                                            </div>
                                        )}

                                        {/* Preview / Existing Image */}
                                        {(cdFile || review.cd_image_url) && (
                                            <div className="relative group w-24 h-24 bg-black/50 rounded-lg overflow-hidden border border-white/10">
                                                <img
                                                    src={cdFile ? URL.createObjectURL(cdFile) : review.cd_image_url!}
                                                    alt="Review attachment"
                                                    className="w-full h-full object-cover"
                                                />
                                                {/* Actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setViewImage({ url: cdFile ? URL.createObjectURL(cdFile) : review.cd_image_url!, prompt: 'CD Review Attachment' })}
                                                        className="p-1.5 bg-zinc-800 text-white rounded-full hover:bg-zinc-700"
                                                        title="View Full"
                                                    >
                                                        <Maximize2 size={12} />
                                                    </button>
                                                    {userProfile?.role === 'CD' && cdFile && (
                                                        <button
                                                            onClick={() => clearFile('cd')}
                                                            className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                                            title="Remove Upload"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {userProfile?.role === 'CD' && (
                                    <button
                                        onClick={() => handleCommentSave('cd', cdFile || undefined)}
                                        className="w-full bg-blue-100 hover:bg-blue-200 text-black py-1 rounded text-sm font-bold"
                                    >
                                        Save Review
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                        Select a version to view feedback
                    </div>
                )}
            </div>

            {/* Modal for viewing image */}
            <ImageViewerModal
                isOpen={!!viewImage}
                onClose={() => setViewImage(null)}
                images={viewImage ? [viewImage] : []}
                initialIndex={0}
            />
        </>
    );
};