import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DriveImage } from '../components/DriveImage';
import { ArrowLeft, Check, X, CheckCircle, XCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import { checkIsMasterCD, masterApproveVersion, masterRejectVersion } from '../api';

interface MasterShot {
  id: string;
  name: string;
  storyboard_url: string | null;
  scene_name: string;
  version_url: string;
  version_number: number;
  version_id: string;
  gdrive_folder_id: string;
  assigned_pe_id: string | null;
  master_cd_vote?: boolean | null;
}

export const MasterView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [shots, setShots] = useState<MasterShot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMasterCD, setIsMasterCD] = useState(false);

  // Rejection modal state
  const [rejectingShot, setRejectingShot] = useState<MasterShot | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectImage, setRejectImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectId) fetchApprovedShots();
    if (userProfile?.email) checkMasterCDStatus();
  }, [projectId, userProfile]);

  const checkMasterCDStatus = async () => {
    if (!userProfile?.email) return;
    try {
      const result = await checkIsMasterCD(userProfile.email);
      setIsMasterCD(result.is_master_cd);
    } catch (error) {
      console.error('Error checking Master CD status:', error);
    }
  };

  const fetchApprovedShots = async () => {
    setLoading(true);
    try {
      // 1. Get Scenes
      const { data: scenes } = await supabase
        .from('scenes')
        .select('id, name')
        .eq('project_id', projectId);

      if (!scenes || scenes.length === 0) {
        setShots([]);
        return;
      }
      const sceneMap = new Map(scenes.map(s => [s.id, s.name]));
      const sceneIds = scenes.map(s => s.id);

      // 2. Get Shots
      const { data: allShots } = await supabase
        .from('shots')
        .select('id, name, scene_id, storyboard_url, gdrive_folder_id, assigned_pe_id')
        .in('scene_id', sceneIds);

      if (!allShots || allShots.length === 0) {
        setShots([]);
        return;
      }
      const shotIds = allShots.map(s => s.id);

      // 3. Get Active Versions
      const { data: versions } = await supabase
        .from('versions')
        .select('id, shot_id, gdrive_link, public_link, version_number')
        .in('shot_id', shotIds)
        .eq('is_active', true);

      if (!versions || versions.length === 0) {
        setShots([]);
        return;
      }
      const shotVersionMap = new Map(versions.map(v => [v.shot_id, v]));
      const versionIds = versions.map(v => v.id);

      // 4. Get Reviews for these versions (include master_cd_vote)
      const { data: reviews } = await supabase
        .from('reviews')
        .select('version_id, pm_vote, cd_vote, master_cd_vote')
        .in('version_id', versionIds);

      if (!reviews) {
        setShots([]);
        return;
      }

      // Build review map
      const reviewMap = new Map(reviews.map(r => [r.version_id, r]));

      // 5. Compile List - CD approved but not yet Master CD approved/rejected
      const approvedShots: MasterShot[] = [];

      for (const shot of allShots) {
        const version = shotVersionMap.get(shot.id);
        if (!version) continue;

        const review = reviewMap.get(version.id);
        if (!review) continue;

        const isApprovedByCD = review.cd_vote === true;
        const isApprovedByPM = review.pm_vote === true;
        const noCDVote = review.cd_vote === null;

        // Logic: CD Yes OR (CD Null AND PM Yes)
        const isCDApproved = isApprovedByCD || (noCDVote && isApprovedByPM);

        if (isCDApproved) {
          approvedShots.push({
            id: shot.id,
            name: shot.name,
            storyboard_url: shot.storyboard_url,
            scene_name: sceneMap.get(shot.scene_id) || 'Unknown Scene',
            version_url: version.gdrive_link || version.public_link,
            version_number: version.version_number,
            version_id: version.id,
            gdrive_folder_id: shot.gdrive_folder_id,
            assigned_pe_id: shot.assigned_pe_id,
            master_cd_vote: review.master_cd_vote
          });
        }
      }

      // Sort by Scene Name then Shot Name (Natural Sort)
      approvedShots.sort((a, b) => {
        const sceneCompare = a.scene_name.localeCompare(b.scene_name, undefined, { numeric: true });
        if (sceneCompare !== 0) return sceneCompare;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });

      setShots(approvedShots);

    } catch (error) {
      console.error('Error fetching master view:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (shot: MasterShot) => {
    if (!userProfile?.email) return;
    setApprovingId(shot.version_id);
    try {
      await masterApproveVersion(
        shot.version_id,
        userProfile.email,
        shot.name,
        shot.gdrive_folder_id
      );
      // Update local state
      setShots(prev => prev.map(s =>
        s.version_id === shot.version_id
          ? { ...s, master_cd_vote: true }
          : s
      ));
    } catch (error: any) {
      console.error('Approve error:', error);
      alert(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingShot || !userProfile?.email || !rejectComment.trim()) return;
    setSubmitting(true);
    try {
      await masterRejectVersion(
        rejectingShot.version_id,
        userProfile.email,
        rejectComment,
        rejectingShot.assigned_pe_id || '',
        rejectingShot.id,
        rejectImage || undefined
      );
      // Update local state
      setShots(prev => prev.map(s =>
        s.version_id === rejectingShot.version_id
          ? { ...s, master_cd_vote: false }
          : s
      ));
      // Close modal
      setRejectingShot(null);
      setRejectComment('');
      setRejectImage(null);
    } catch (error: any) {
      console.error('Reject error:', error);
      alert(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  // Group by Scene
  const groupedShots = shots.reduce((acc, shot) => {
    if (!acc[shot.scene_name]) acc[shot.scene_name] = [];
    acc[shot.scene_name].push(shot);
    return acc;
  }, {} as Record<string, MasterShot[]>);

  // Filter: pending = null, approved = true, rejected = false
  const pendingShots = shots.filter(s => s.master_cd_vote === null || s.master_cd_vote === undefined);
  const approvedByMaster = shots.filter(s => s.master_cd_vote === true);
  const rejectedByMaster = shots.filter(s => s.master_cd_vote === false);

  return (
    <div className="min-h-screen flex flex-col text-white">
      {/* FIXED HEADER */}
      <div className="flex items-center justify-between gap-4 p-8 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-full">
            <ArrowLeft />
          </button>
          <h1 className="text-3xl font-bold">Master View - CD Approved Shots</h1>
        </div>
        {isMasterCD && (
          <div className="flex items-center gap-4 text-sm">
            <span className="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full border border-purple-700">
              Master CD
            </span>
            <span className="text-zinc-400">
              Pending: <span className="text-yellow-400">{pendingShots.length}</span> |
              Synced: <span className="text-green-400">{approvedByMaster.length}</span> |
              Rejected: <span className="text-red-400">{rejectedByMaster.length}</span>
            </span>
          </div>
        )}
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedShots)
              .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
              .map(([sceneName, sceneShots]) => (
                <div key={sceneName}>
                  <h2 className="text-2xl font-bold mb-4 text-zinc-400 border-b border-zinc-700 pb-2">
                    {sceneName}
                  </h2>

                  {/* HORIZONTAL SCROLLING CONTAINER */}
                  <div className="flex flex-nowrap overflow-x-auto gap-6 pb-4">
                    {sceneShots.map(shot => (
                      <div key={shot.id} className="w-[350px] flex-none bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                        <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                          <span className="font-bold text-lg text-zinc-200">{shot.name}</span>
                          <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">v{shot.version_number}</span>
                        </div>

                        {/* Storyboard */}
                        <div className="px-3 py-1.5 text-xs font-bold text-zinc-400 bg-zinc-900/50 border-b border-zinc-800">
                          Storyboard
                        </div>
                        <div className="aspect-video bg-black border-b border-zinc-700">
                          {shot.storyboard_url ? (
                            <DriveImage src={shot.storyboard_url} className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm italic">No Storyboard</div>
                          )}
                        </div>

                        {/* Final Shot */}
                        <div className="px-3 py-1.5 text-xs font-bold text-green-400 bg-green-900/10 border-b border-zinc-800 flex items-center gap-2">
                          <Check size={12} />
                          CD Approved
                        </div>
                        <div className="aspect-video bg-black">
                          <DriveImage src={shot.version_url} className="w-full h-full object-cover" />
                        </div>

                        {/* Master CD Status / Actions */}
                        {isMasterCD && (
                          <div className="p-3 border-t border-zinc-700 bg-zinc-900/50">
                            {shot.master_cd_vote === true ? (
                              <div className="flex items-center gap-2 text-green-400 text-sm">
                                <CheckCircle size={16} />
                                <span>Synced to Drive</span>
                              </div>
                            ) : shot.master_cd_vote === false ? (
                              <div className="flex items-center gap-2 text-red-400 text-sm">
                                <XCircle size={16} />
                                <span>Rejected - PE Notified</span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(shot)}
                                  disabled={approvingId === shot.version_id}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium text-sm disabled:opacity-50"
                                >
                                  {approvingId === shot.version_id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <CheckCircle size={14} />
                                  )}
                                  Approve & Sync
                                </button>
                                <button
                                  onClick={() => setRejectingShot(shot)}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded font-medium text-sm border border-red-600/50"
                                >
                                  <XCircle size={14} />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {shots.length === 0 && (
              <div className="text-center text-zinc-500 py-12">
                <h3 className="text-xl font-bold text-zinc-300 mb-2">No CD Approved Shots</h3>
                <p className="text-zinc-500">Wait for the CD and PM to approve versions.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* REJECTION MODAL */}
      {rejectingShot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Reject Shot: {rejectingShot.name}</h3>
              <button onClick={() => setRejectingShot(null)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Feedback *</label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Explain what needs to be changed..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Attach Reference Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => setRejectImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {rejectImage ? (
                  <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
                    <ImageIcon size={16} className="text-zinc-400" />
                    <span className="text-sm text-zinc-300 flex-1 truncate">{rejectImage.name}</span>
                    <button onClick={() => setRejectImage(null)} className="text-zinc-400 hover:text-red-400">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 border border-dashed border-zinc-600 rounded-lg text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 text-sm flex items-center justify-center gap-2"
                  >
                    <ImageIcon size={16} />
                    Click to attach image
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-700 flex gap-3">
              <button
                onClick={() => setRejectingShot(null)}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectComment.trim() || submitting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Reject & Notify PE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
