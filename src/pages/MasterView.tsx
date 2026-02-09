import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { DriveImage } from '../components/DriveImage';
import { ArrowLeft,Check } from 'lucide-react';

interface MasterShot {
  id: string;
  name: string;
  storyboard_url: string | null;
  scene_name: string;
  version_url: string;
  version_number: number;
}

export const MasterView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [shots, setShots] = useState<MasterShot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) fetchApprovedShots();
  }, [projectId]);

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
        .select('id, name, scene_id, storyboard_url')
        .in('scene_id', sceneIds);

      if (!allShots || allShots.length === 0) {
        setShots([]);
        return;
      }
      const shotIds = allShots.map(s => s.id);

      // 3. Get Active Versions
      const { data: versions } = await supabase
        .from('versions')
        .select('id, shot_id, gdrive_link, version_number')
        .in('shot_id', shotIds)
        .eq('is_active', true);

      if (!versions || versions.length === 0) {
        setShots([]);
        return;
      }
      const shotVersionMap = new Map(versions.map(v => [v.shot_id, v]));
      const versionIds = versions.map(v => v.id);

      // 4. Get Reviews for these versions
      const { data: reviews } = await supabase
        .from('reviews')
        .select('version_id, pm_vote, cd_vote')
        .in('version_id', versionIds);

      if (!reviews) {
        setShots([]);
        return;
      }

      const approvedVersionIds = new Set<string>();
      reviews.forEach(r => {
        const isApprovedByCD = r.cd_vote === true;
        const isApprovedByPM = r.pm_vote === true;
        const noCDVote = r.cd_vote === null;

        // Logic: CD Yes OR (CD Null AND PM Yes)
        if (isApprovedByCD || (noCDVote && isApprovedByPM)) {
          approvedVersionIds.add(r.version_id);
        }
      });

      // 5. Compile List
      const approvedShots: MasterShot[] = [];

      for (const shot of allShots) {
        const version = shotVersionMap.get(shot.id);
        if (version && approvedVersionIds.has(version.id)) {
          approvedShots.push({
            id: shot.id,
            name: shot.name,
            storyboard_url: shot.storyboard_url,
            scene_name: sceneMap.get(shot.scene_id) || 'Unknown Scene',
            version_url: version.gdrive_link,
            version_number: version.version_number
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

  // Group by Scene
  const groupedShots = shots.reduce((acc, shot) => {
    if (!acc[shot.scene_name]) acc[shot.scene_name] = [];
    acc[shot.scene_name].push(shot);
    return acc;
  }, {} as Record<string, MasterShot[]>);

  return (
    <div className="min-h-screen flex flex-col text-white">
      {/* FIXED HEADER */}
      <div className="flex items-center gap-4 p-8 border-b border-zinc-800 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-full">
          <ArrowLeft />
        </button>
          <h1 className="text-3xl font-bold">Master View - Approved Shots</h1>
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div>Loading...</div>
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
                  <div className="flex flex-nowrap overflow-x-auto gap-6 pb-4 ">
                    {sceneShots.map(shot => (
                      /* flex-none ensures cards don't shrink and stay side-by-side */
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
                            <DriveImage src={shot.storyboard_url} className="w-full h-full object-contain " />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm italic">No Storyboard</div>
                          )}
                        </div> 

                        {/* Final Shot */}
                        <div className="px-3 py-1.5 text-xs font-bold text-green-400 bg-green-900/10 border-b border-zinc-800 flex items-center gap-2">
                            <Check size={12} />
                        Approved Shot
                      </div>
                      <div className="aspect-video bg-black">
                          <DriveImage src={shot.version_url} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {shots.length === 0 && (
              <div className="text-center text-zinc-500 py-12">
                <div className="p-4 bg-white/5 rounded-full mb-4">
                  {/* Icon placeholder if needed */}
                </div>
                <h3 className="text-xl font-bold text-zinc-300 mb-2">No Approved Shots</h3>
                <p className="text-zinc-500">Wait for the CD and PM to approve versions.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
