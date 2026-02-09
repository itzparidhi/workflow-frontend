import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Scene, Shot } from '../types';
import { useNavigate } from 'react-router-dom';
import { insertShotAtPosition, reorderShots, createStructureWithSequence } from '../api';
// import { Plus } from 'lucide-react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { softDeleteShot } from '../api';
import { Plus, Trash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SceneListProps {
  projectId: string;
}

interface ShotWithStatus extends Shot {
  statusColor: 'gray' | 'yellow' | 'red' | 'green';
}

interface ShotCardProps {
  shot: ShotWithStatus;
  onNavigate: (shotId: string) => void;
  onInsertBefore: (sceneId: string, sequence: number) => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleteEnabled: boolean;
  sceneId: string;
}

const SortableShotCard: React.FC<ShotCardProps> = ({
  shot,
  onNavigate,
  onInsertBefore,
  onDelete,
  isDeleteEnabled,
  sceneId,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group flex items-center gap-2"
    >
      {/* Insert button before shot */}
      <button
        onClick={() => onInsertBefore(sceneId, shot.sequence)}
        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-full text-xs bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded flex items-center justify-center text-blue-300"
        title="Insert shot before this one"
      >
        +
      </button>
      
      <div
        {...attributes}
        {...listeners}
        onClick={() => onNavigate(shot.id)}
        className="cursor-grab active:cursor-grabbing w-32 h-20 !rounded-[20px] flex items-center justify-center border transition-all glass-panel bg-white/5 border-white/10 dark:bg-white/5 dark:border-white/10 hover:border-white/30 hover:scale-105 shadow-glass relative"
      >
        <div
          className={`
            w-2.5 h-2.5 rounded-full absolute top-3 right-3 shadow-sm
            ${shot.statusColor === 'green' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ''}
            ${shot.statusColor === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : ''}
            ${shot.statusColor === 'yellow' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : ''}
            ${shot.statusColor === 'gray' ? 'bg-zinc-800' : ''}
          `}
        ></div>
        <span className="text-sm font-medium truncate px-2 shot-text">
          {shot.name}
        </span>
        
        {/* Delete Button (CD Only) */}
        {isDeleteEnabled && (
          <button
              onClick={onDelete}
              className="absolute top-2 left-2 p-1 bg-black/50 hover:bg-red-500/80 rounded-full text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10 backdrop-blur-sm"
              title="Delete Shot"
          >
              <Trash size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export const SceneList: React.FC<SceneListProps> = ({ projectId }) => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shotsByScene, setShotsByScene] = useState<Record<string, ShotWithStatus[]>>({});
  const [creatingShotFor, setCreatingShotFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, {
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchScenes();
  }, [projectId]);

  const fetchScenes = async () => {
    const { data: scenesData } = await supabase
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (scenesData) {
      setScenes(scenesData);
      scenesData.forEach(scene => fetchShotsForScene(scene.id));
    }
  };

  const fetchShotsForScene = async (sceneId: string) => {
    // Fetch shots ordered by sequence
    const { data: shotsData } = await supabase
      .from('shots')
      .select('*')
      .eq('scene_id', sceneId)
      .order('sequence', { ascending: true });

    if (!shotsData) return;

    // Filter out deleted shots
    const activeShots = shotsData.filter(s => !s.is_deleted);
    const shotIds = activeShots.map(s => s.id);
    
    if (shotIds.length === 0) {
      setShotsByScene(prev => ({ ...prev, [sceneId]: [] }));
      return;
    }

    const { data: versionsData } = await supabase
      .from('versions')
      .select('*, reviews(*)')
      .in('shot_id', shotIds)
      .eq('is_active', true);



    const shotsWithStatus: ShotWithStatus[] = activeShots.map(shot => {
      const activeVersion = versionsData?.find(v => v.shot_id === shot.id);
      let color: 'gray' | 'yellow' | 'red' | 'green' = 'gray';

      if (activeVersion) {
        const review = activeVersion.reviews?.[0] || (activeVersion as any).reviews;
        const r = Array.isArray(review) ? review[0] : review;

        if (r?.cd_vote === true) color = 'green';
        else if (r?.cd_vote === false || r?.pm_vote === false) color = 'red';
        else color = 'yellow';
      }

      return { ...shot, statusColor: color };
    });

    setShotsByScene(prev => ({ ...prev, [sceneId]: shotsWithStatus }));
  };

  const handleAddShot = async (scene: Scene) => {
    setCreatingShotFor(scene.id);
    try {
      // Get shots for this scene to count them
      const shots = shotsByScene[scene.id] || [];
      const nextShotNumber = shots.length + 1;
      const shotName = `Shot_${nextShotNumber}`;

      // Create structure with sequence
      await createStructureWithSequence({
        type: 'shot',
        name: shotName,
        parentDbId: scene.id,
        parentFolderId: scene.gdrive_folder_id,
        sequence: shots.length,
      });

      // Refresh list
      await fetchShotsForScene(scene.id);
    } catch (err) {
      console.error('Error creating shot:', err);
      alert('Failed to create shot');
    } finally {
      setCreatingShotFor(null);
    }
  };

  const handleSoftDelete = async (e: React.MouseEvent, shotId: string, sceneId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to move this shot to the trash?")) return;

    try {
      await softDeleteShot(shotId);
      // Optimistic update
      setShotsByScene(prev => ({
        ...prev,
        [sceneId]: prev[sceneId].filter(s => s.id !== shotId)
      }));
    } catch (err: any) {
      console.error("Failed to delete shot:", err);
      alert(err.response?.data?.detail || "Failed to delete shot");
    }
  };

  const handleInsertShot = async (sceneId: string, beforeSequence: number) => {
    const shotName = prompt(`Enter name for new shot to insert at position ${beforeSequence}:`, `Shot_${beforeSequence}`);

    if (!shotName) return;

    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setCreatingShotFor(sceneId);
    try {
      await insertShotAtPosition({
        scene_id: sceneId,
        name: shotName,
        parent_folder_id: scene.gdrive_folder_id,
        sequence: beforeSequence,
      });

      // Refresh and renumber shots
      await fetchShotsForScene(sceneId);
      await renumberShots(sceneId);
    } catch (err) {
      console.error('Error inserting shot:', err);
      alert('Failed to insert shot');
    } finally {
      setCreatingShotFor(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, sceneId: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const shots = shotsByScene[sceneId];
    if (!shots) return;

    const oldIndex = shots.findIndex(s => s.id === active.id);
    const newIndex = shots.findIndex(s => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const newShots = arrayMove(shots, oldIndex, newIndex);
    setShotsByScene(prev => ({ ...prev, [sceneId]: newShots }));

    try {
      // Update sequences
      const updatedShots = newShots.map((shot, index) => ({
        ...shot,
        sequence: index,
      }));

      await reorderShots({
        scene_id: sceneId,
        shots: updatedShots.map(s => ({ id: s.id, sequence: s.sequence })),
      });

      // Refresh to ensure consistency
      await fetchShotsForScene(sceneId);
    } catch (err) {
      console.error('Error reordering shots:', err);
      alert('Failed to reorder shots');
      // Revert on error
      await fetchShotsForScene(sceneId);
    }
  };

  const renumberShots = async (sceneId: string) => {
    const shots = shotsByScene[sceneId];
    if (!shots) return;

    const updatedShots = shots.map((shot, index) => ({
      id: shot.id,
      sequence: index,
      name: `Shot_${index + 1}`,
    }));

    try {
      // Update names and sequences in DB
      for (const shot of updatedShots) {
        await supabase
          .from('shots')
          .update({ name: shot.name, sequence: shot.sequence })
          .eq('id', shot.id);
      }

      await fetchShotsForScene(sceneId);
    } catch (err) {
      console.error('Error renumbering shots:', err);
    }
  };

  return (
    <div className="space-y-8">
      {scenes.map(scene => (
        <div key={scene.id} className="glass-panel p-4 rounded-lg border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 
              onClick={() => navigate(`/project/${projectId}/scene/${scene.id}`)}
              className="text-lg font-semibold text-zinc-300 hover:text-white cursor-pointer transition-colors"
            >
              {scene.name}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const shots = shotsByScene[scene.id];
                  const nextSeq = shots ? shots.length : 0;
                  handleInsertShot(scene.id, nextSeq);
                }}
                disabled={creatingShotFor === scene.id}
                className="text-xs glass-button hover:bg-white/20 text-white px-3 py-1 rounded-full shadow-md flex items-center gap-1"
                title="Insert shot at the end"
              >
                {creatingShotFor === scene.id ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus size={12} />
                    INSERT SHOT
                  </>
                )}
              </button>
              <button
                onClick={() => handleAddShot(scene)}
                disabled={creatingShotFor === scene.id}
                className="text-xs glass-button hover:bg-white/20 text-white px-3 py-1 rounded-full shadow-md flex items-center gap-1"
              >
                {creatingShotFor === scene.id ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus size={12} />
                    ADD SHOT
                  </>
                )}
              </button>
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(e, scene.id)}
          >
            <SortableContext
              items={shotsByScene[scene.id]?.map(s => s.id) || []}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex flex-wrap gap-4">
                {shotsByScene[scene.id]?.map(shot => (
                  <SortableShotCard
                    key={shot.id}
                    shot={shot}
                    onNavigate={() => navigate(`/shot/${shot.id}`)}
                    onInsertBefore={handleInsertShot}
                    onDelete={(e) => handleSoftDelete(e, shot.id, scene.id)}
                    isDeleteEnabled={userProfile?.role === 'CD'}
                    sceneId={scene.id}
                  />
                ))}
                {(!shotsByScene[scene.id] || shotsByScene[scene.id].length === 0) && (
                  <p className="text-zinc-500 text-sm italic">No shots</p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ))}
    </div>
  );
};
