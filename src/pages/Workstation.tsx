import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, X } from 'lucide-react';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { useWorkstation } from '../hooks/useWorkstation';
import { generateImage, fetchGenerations } from '../api';
import type { Generation } from '../types';
import { DriveIcon } from '../components/DriveIcon';
import { supabase } from '../supabaseClient';

// Import new components
import { ReferencePanel } from '../components/workstation/ReferencePanel';
import { GenerationTools } from '../components/workstation/GenerationTools';
import { MainPlayer } from '../components/workstation/MainPlayer';
import { GenerationsSlider } from '../components/workstation/GenerationsSlider';
import { DriveImage } from '../components/DriveImage';
import { FeedbackPanel } from '../components/workstation/FeedbackPanel';
import { BackgroundGridResultsModal } from '../components/BackgroundGridResultsModal';
import { getDirectDriveLink, getExportViewLink } from '../utils/drive';
import { useDialog } from '../context/DialogContext';

export const Workstation: React.FC = () => {
  const navigate = useNavigate();
  const dialog = useDialog();

  // AI Generation State
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('Gemini 2.0 Flash');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<'manual' | 'automatic' | 'storyboard_enhancer' | 'angles' | 'background_grid'>('manual');
  const [selectedAutoTabs, setSelectedAutoTabs] = useState<string[]>([]);
  const [characterTabs, setCharacterTabs] = useState<{ id: string; name: string; file: File | null }[]>([
    { id: 'char_1', name: 'Character 1', file: null }
  ]);

  // Background Grid State
  const [backgroundGridFile, setBackgroundGridFile] = useState<File | null>(null);
  const [backgroundGridResults, setBackgroundGridResults] = useState<string[]>([]);
  const [isBackgroundGridModalOpen, setIsBackgroundGridModalOpen] = useState(false);


  // New States for Generation
  const [resolution, setResolution] = useState('1K');
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [viewerState, setViewerState] = useState<{ isOpen: boolean; index: number }>({ isOpen: false, index: 0 });
  const [refImages, setRefImages] = useState<File[]>([]);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Tagging Autocomplete State
  const [showTagMenu, setShowTagMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // New Workflow State
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const customUploadRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<any>(null);

  // Project ID for character resources
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showCharacterModalFromMention, setShowCharacterModalFromMention] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<any[]>([]);

  // Selected Background for Auto Mode
  const [selectedBackgroundUrl, setSelectedBackgroundUrl] = useState<string | null>(null);

  // HOISTED HOOK
  const {
    shot,
    versions,
    activeVersion,
    setActiveVersion,
    fetchReview,
    review,
    uploadingRefs,
    fullScreenImage,
    setFullScreenImage,
    zoomLevel,
    setZoomLevel,
    pmCommentRef,
    cdCommentRef,
    handleReferenceUpload,
    handleUpload,
    handleVote,
    handleCommentSave,
    canUploadVersion,
    userProfile,
    uploadProgress,
    uploadStatus,
    handleGenerateBackgroundGrid,
    saveBackgroundReferences
  } = useWorkstation();

  // Define toggleAccordion (missing previously?)
  const toggleAccordion = (id: string) => {
    setOpenAccordion(prev => prev === id ? null : id);
  };

  const handleBackgroundGridUpload = (e: React.ChangeEvent<HTMLInputElement>) => validateFile(e, setBackgroundGridFile);

  const handleSaveBackgrounds = async (urls: string[]) => {
    // Save all URLs at once
    try {
      await saveBackgroundReferences(urls);
      // setIsBackgroundGridModalOpen(false); // Keep modal open or close? User might want to save more? Usually close.
      // But wait, the original code didn't check success.
      dialog.alert('Success', `Saved ${urls.length} background(s) to references!`, 'success');
    } catch (e: any) {
      console.error(e);
      dialog.alert('Error', 'Failed to save backgrounds.', 'danger');
    }
  };
  // Fetch project ID from scene when shot loads
  useEffect(() => {
    const fetchProjectId = async () => {
      if (!shot?.scene_id) return;

      const { data } = await supabase
        .from('scenes')
        .select('project_id')
        .eq('id', shot.scene_id)
        .single();

      if (data) setProjectId(data.project_id);
    };

    fetchProjectId();
  }, [shot?.scene_id]);



  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    // Check for tagging trigger '@'
    const cursorIndex = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorIndex);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      // If we typed @, check what comes after
      const query = textBeforeCursor.substring(lastAtPos + 1);

      // Check for @ch trigger for character selection
      if (query.toLowerCase() === 'ch' && projectId) {
        setShowCharacterModalFromMention(true);
        return;
      }

      // Show image tag menu if no space after @ and we have ref images
      if (!query.includes(' ') && refImages.length > 0) {
        setShowTagMenu(true);

        return;
      }
    }
    setShowTagMenu(false);
  };

  const insertTag = (tag: string) => {
    if (!textareaRef.current) return;

    const val = prompt;
    const cursorIndex = textareaRef.current.selectionStart;
    const textBeforeCursor = val.substring(0, cursorIndex);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    const newVal = val.substring(0, lastAtPos) + tag + ' ' + val.substring(cursorIndex);
    setPrompt(newVal);
    setShowTagMenu(false);

    // Refocus and set cursor
    setTimeout(() => {
      textareaRef.current?.focus();
      // Position cursor after inserted tag
      // ... implementation detail
    }, 0);
  };

  const handleCharacterMentionSelect = async (characters: any[]) => {
    if (!textareaRef.current || characters.length === 0) return;

    const val = prompt;
    const cursorIndex = textareaRef.current.selectionStart;
    const textBeforeCursor = val.substring(0, cursorIndex);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    // Insert character names with @ prefix, separated by commas
    const characterTags = characters.map(c => `@${c.name}`).join(' ');
    const newVal = val.substring(0, lastAtPos) + characterTags + ' ' + val.substring(cursorIndex);
    setPrompt(newVal);
    setShowCharacterModalFromMention(false);

    // Fetch character images and add to refImages
    const getPreviewUrl = (gdriveLink: string) => {
      // Supabase or Direct URL check
      if (gdriveLink.includes('supabase.co') || gdriveLink.startsWith('http')) return gdriveLink;

      const match = gdriveLink.match(/\/d\/([^\/]+)/);
      if (match) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
      }
      return gdriveLink.replace('/view', '/preview');
    };

    for (const character of characters) {
      try {
        const imageUrl = getPreviewUrl(character.gdrive_link);
        const response = await fetch(imageUrl, { referrerPolicy: 'no-referrer' });
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], `${character.name}.png`, { type: 'image/png' });
          setRefImages(prev => [...prev, file]);
        }
      } catch (e) {
        console.warn(`Failed to fetch character image for ${character.name}:`, e);
      }
    }

    // Refocus and set cursor
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };
  // Clean up ObjectURLs to prevent memory leaks
  useEffect(() => {
    return () => {
      // In a real app we'd track these URLs and revoke them
    };
  }, []);


  // Automatic mode isolated upload state
  const [autoStoryboardFile, setAutoStoryboardFile] = useState<File | null>(null);
  const [autoBackgroundFile, setAutoBackgroundFile] = useState<File | null>(null);
  const [autoCharacterFiles, setAutoCharacterFiles] = useState<{ [id: string]: File | null }>({});

  // Angles Mode State
  const [anglesAngle, setAnglesAngle] = useState('');
  const [anglesLength, setAnglesLength] = useState('');
  const [anglesFocus, setAnglesFocus] = useState('');
  const [anglesBackground, setAnglesBackground] = useState('');
  const [anglesAnchorFile, setAnglesAnchorFile] = useState<File | null>(null);
  const [anglesTargetFile, setAnglesTargetFile] = useState<File | null>(null);

  // POLLING LOGIC
  const pollIntervalRef = useRef<any | null>(null);

  const loadGenerations = async (shotId: string): Promise<boolean> => {
    try {
      const data = await fetchGenerations(shotId);
      setGenerations(prev => {
        // Optimistic Merge: Keep local pending items that haven't appeared in the server list yet
        // This handles the race condition where calling loadGenerations immediately after create
        // might return a stale list without the new generation.
        const serverIds = new Set(data.map((g: Generation) => g.id));
        const missingPending = prev.filter(g => g.status === 'pending' && !serverIds.has(g.id));

        if (missingPending.length > 0) {
          // Sort merged list to ensure correct order
          const merged = [...missingPending, ...data];
          // Determine unique items by ID (if any dups slipped in)
          const uniqueMap = new Map();
          merged.forEach(g => uniqueMap.set(g.id, g));
          return Array.from(uniqueMap.values()).sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        return data;
      });
      // Check if any are pending
      return data.some((g: Generation) => g.status === 'pending');
    } catch (err) {
      console.error("Failed to load generations", err);
      return false;
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const startPolling = (shotId: string) => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(async () => {
      const hasPending = await loadGenerations(shotId);
      if (!hasPending) {
        stopPolling();
      }
    }, 3000);
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleAnglesAnchorUpload = (e: React.ChangeEvent<HTMLInputElement>) => validateFile(e, setAnglesAnchorFile);
  const handleAnglesTargetUpload = (e: React.ChangeEvent<HTMLInputElement>) => validateFile(e, setAnglesTargetFile);

  // Handlers for auto mode uploads
  const handleAutoStoryboardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setAutoStoryboardFile(file);
      } else {
        dialog.alert('Error', 'Please select a valid image file.', 'warning');
      }
    }
  };

  const handleAutoBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setAutoBackgroundFile(file);
      } else {
        dialog.alert('Error', 'Please select a valid image file.', 'warning');
      }
    }
  };

  const validateFile = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setter(file);
      } else {
        dialog.alert('Error', 'Please select a valid image file.', 'warning');
      }
    }
  };

  const handleAutoCharacterUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setAutoCharacterFiles(prev => ({ ...prev, [id]: file }));
      } else {
        dialog.alert('Error', 'Please select a valid image file.', 'warning');
      }
    }
  };
  const removeAutoCharacterFile = (id: string) => {
    setAutoCharacterFiles(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const fileInputRefs = {
    storyboard: useRef<HTMLInputElement>(null),

    background: useRef<HTMLInputElement>(null),

    // Angles mode refs
    anglesAnchor: useRef<HTMLInputElement>(null),
    anglesTarget: useRef<HTMLInputElement>(null),
    // Background Grid
    backgroundGrid: useRef<HTMLInputElement>(null),
    // Dynamic refs map
    characters: useRef<Map<string, HTMLInputElement>>(new Map())
  };

  const addCharacterTab = () => {
    const nextNum = characterTabs.length + 1;
    setCharacterTabs(prev => [...prev, {
      id: `char_${Date.now()}`,
      name: `Character ${nextNum}`,
      file: null
    }]);
  };


  const removeCharacterTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when deleting
    setCharacterTabs(prev => prev.filter(tab => tab.id !== id));
    setSelectedAutoTabs(prev => prev.filter(tid => tid !== id));
  };


  const handleRestore = async (gen: Generation) => {
    dialog.confirm(
      "Restore Settings?",
      "Restore settings from this generation? Current inputs will be replaced.",
      async () => {
        setPrompt(gen.prompt);
        setSelectedModel(gen.model);
        setAspectRatio(gen.aspect_ratio);
        setResolution(gen.resolution || '1K');

        if (gen.ref_data) {
          setGenerationMode(gen.ref_data.mode);

          // Helper to fetch file
          const fetchFile = async (url: string, name: string, type: string = 'image/png') => {
            try {
              const r = await fetch(url);
              const blob = await r.blob();
              return new File([blob], name, { type });
            } catch (e) {
              console.error("Failed to restore file", name, e);
              return null;
            }
          };

          if (gen.ref_data.mode === 'manual') {
            const files: File[] = [];
            for (const ref of gen.ref_data.manual_refs) {
              const f = await fetchFile(ref.url, ref.name, ref.type);
              if (f) files.push(f);
            }
            setRefImages(files);
          } else if (gen.ref_data.mode === 'automatic') {
            // Restore Auto Inputs
            const refs = gen.ref_data.auto_refs;
            const newSelectedTabs: string[] = [];

            if (refs.storyboard) {
              const f = await fetchFile(refs.storyboard, "restored_storyboard.png");
              setAutoStoryboardFile(f);
              newSelectedTabs.push('storyboard');
            }
            newSelectedTabs.push('background');
            if (refs.characters && refs.characters.length > 0) {
              // Reset tabs to match count
              const newTabs = refs.characters.map((_c, i) => ({
                id: `char_restored_${Date.now()}_${i}`,
                name: `Character ${i + 1}`,
                file: null
              }));
              setCharacterTabs(newTabs);

              const newFiles: { [id: string]: File | null } = {};
              for (let i = 0; i < refs.characters.length; i++) {
                const charRef = refs.characters[i];
                const f = await fetchFile(charRef.url, charRef.name);
                newFiles[newTabs[i].id] = f;
                newSelectedTabs.push(newTabs[i].id);
              }
              setAutoCharacterFiles(newFiles);
            }
            setSelectedAutoTabs(newSelectedTabs);
          } else if (gen.ref_data.mode === 'angles') {
            const refs = gen.ref_data.auto_refs;
            const inputs = gen.ref_data.angles_inputs;

            if (inputs) {
              setAnglesAngle(inputs.angle || '');
              setAnglesLength(inputs.length || '');
              setAnglesFocus(inputs.focus || '');
              setAnglesBackground(inputs.background || '');
            }

            if (refs.angles_anchor) {
              const f = await fetchFile(refs.angles_anchor, "restored_anchor.png");
              setAnglesAnchorFile(f);
            } else {
              setAnglesAnchorFile(null);
            }

            if (refs.angles_target) {
              const f = await fetchFile(refs.angles_target, "restored_target.png");
              setAnglesTargetFile(f);
            } else {
              setAnglesTargetFile(null);
            }
          } else if (gen.ref_data.mode === 'storyboard_enhancer') {
            // RESTORE ENHANCER MODE
            if (gen.ref_data.auto_refs && gen.ref_data.auto_refs.storyboard) {
              const f = await fetchFile(gen.ref_data.auto_refs.storyboard, "restored_storyboard.png");
              setAutoStoryboardFile(f);
              setSelectedAutoTabs(['storyboard']);
            }
          }
        }
      },
      'info'
    );
  };

  const handleGenerate = async () => {
    // In Manual Mode, prompt is required. In Auto Mode, prompt is constructed by backend.
    if (generationMode === 'manual' && !prompt) return;

    // BACKGROUND GRID MODE HANDLER
    if (generationMode === 'background_grid') {
      if (!backgroundGridFile) {
        dialog.alert('Error', "Please upload a base background image.", 'warning');
        return;
      }
      setIsGenerating(true);
      try {
        const urls = await handleGenerateBackgroundGrid(backgroundGridFile, prompt, aspectRatio);
        setBackgroundGridResults(urls);
        setIsBackgroundGridModalOpen(true);
      } catch (e: any) {
        const errMsg = e.response?.data?.detail || e.message || 'Unknown error';
        dialog.alert('Error', `Background Grid Generation failed: ${errMsg}`, 'danger');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    setIsGenerating(true);
    try {
      // Prepare Auto Inputs
      let autoStoryboard: File | null = null;
      let autoLighting: File | null = null; // Used for "Previous Frame"
      let autoBackground: File | null = null;
      const autoCharacters: File[] = [];

      // Helper for robust fetching
      const fetchImageBlob = async (url: string): Promise<Blob | null> => {
        try {
          // 0. Check for Supabase / Direct URL
          if (url.includes('supabase.co') || !url.includes('google.com')) {
            try {
              const r = await fetch(url);
              if (r.ok) return await r.blob();
            } catch (e) {
              console.warn('Direct fetch failed', e);
            }
          }

          // 1. Try Direct Link (High Res) google drive
          let fetchUrl = getDirectDriveLink(url);
          let r = await fetch(fetchUrl, { referrerPolicy: "no-referrer" });

          if (!r.ok || r.headers.get('content-type')?.includes('text/html')) {
            // 2. Try Export View (Fallback)
            console.warn('Direct fetch failed or returned HTML, trying export view fallback...', url);
            fetchUrl = getExportViewLink(url);
            r = await fetch(fetchUrl, { referrerPolicy: "no-referrer" });
          }

          if (r.ok) {
            const blob = await r.blob();
            if (blob.type.includes('text/html')) {
              console.error('Fetched content is HTML, not image.', url);
              return null;
            }
            return blob;
          }
        } catch (e) {
          console.error("Failed to fetch image blob", e);
        }
        return null;
      };

      if (generationMode === 'automatic') {
        // ... (rest of existing auto logic)
        // 1. Storyboard
        if (selectedAutoTabs.includes('storyboard')) {
          if (autoStoryboardFile) {
            autoStoryboard = autoStoryboardFile;
          } else if (shot?.storyboard_url) {
            const blob = await fetchImageBlob(shot.storyboard_url);
            if (blob) {
              autoStoryboard = new File([blob], "storyboard.png", { type: "image/png" });
            }
          }
        }



        // 3. Background
        if (selectedAutoTabs.includes('background')) {
          if (autoBackgroundFile) {
            autoBackground = autoBackgroundFile;
          } else if (selectedBackgroundUrl) {
            const blob = await fetchImageBlob(selectedBackgroundUrl);
            if (blob) {
              autoBackground = new File([blob], "background.png", { type: "image/png" });
            }
          } else if (shot?.background_urls && shot.background_urls.length > 0) {
            const blob = await fetchImageBlob(shot.background_urls[0]);
            if (blob) {
              autoBackground = new File([blob], "background.png", { type: "image/png" });
            }
          }
        }

        // 3. Characters
        // (A) From Tabs (Old/Upload)
        for (const tab of characterTabs) {
          if (selectedAutoTabs.includes(tab.id)) {
            if (autoCharacterFiles[tab.id]) {
              autoCharacters.push(autoCharacterFiles[tab.id]!);
            } else if (tab.file) {
              autoCharacters.push(tab.file);
            } else if (tab.id === 'char_1' && shot?.style_url) {
              const blob = await fetchImageBlob(shot.style_url);
              if (blob) {
                autoCharacters.push(new File([blob], "char1.png", { type: "image/png" }));
              }
            }
          }
        }
        // (B) From Selected Characters (New/Resources)
        for (const char of selectedCharacters) {
          const blob = await fetchImageBlob(char.gdrive_link);
          if (blob) {
            autoCharacters.push(new File([blob], `${char.name.replace(/\s+/g, '_')}.png`, { type: "image/png" }));
          }
        }
      } else if (generationMode === 'storyboard_enhancer') {
        // STORYBOARD ENHANCER MODE
        // Logic: "Enhance the @storyboard into a more detailed digital sketch."

        // Use autoStoryboardFile if present (uploaded via the Enhancer tab)
        // Or fallback to shot.storyboard_url
        if (autoStoryboardFile) {
          autoStoryboard = autoStoryboardFile;
        } else if (shot?.storyboard_url) {
          try {
            const r = await fetch(shot.storyboard_url);
            if (r.ok) {
              const blob = await r.blob();
              autoStoryboard = new File([blob], "storyboard.png", { type: "image/png" });
            }
          } catch (e) {
            console.warn("Failed to fetch storyboard for enhancer generation", e);
          }
        }
      } else if (generationMode === 'angles') {
        // ANGLES MODE: All inputs are optional
      }

      // Optimistic Update: Add a pending item immediately
      const tempId = `temp-${Date.now()}`;
      const tempGen: Generation = {
        id: tempId,
        shot_id: shot!.id,
        created_at: new Date().toISOString(),
        image_url: '',
        status: 'pending',
        prompt: prompt || (generationMode === 'angles' ? `Angle: ${anglesAngle}` : 'Processing...'),
        model: selectedModel,
        aspect_ratio: aspectRatio,
        resolution: resolution,
        ref_data: {
          mode: generationMode,
          manual_refs: [],
          auto_refs: {}
        }
      };
      setGenerations(prev => [tempGen, ...prev]);

      // Call API (don't await blocking UI)
      const getModelId = (name: string) => {
        if (name === 'Gemini 3 Pro' || name === 'Google Nanobanana Pro') return 'gemini-3-pro-image-preview';
        // Default to Gemini 2.0 Flash (for "Gemini 2.0 Flash", "Google Nanobanana", or fallback)
        return 'gemini-2.0-flash-exp';
      };

      generateImage({
        prompt: prompt || '',
        mode: generationMode,
        shot_id: shot!.id,
        user_email: userProfile?.email || 'Unknown',
        model: getModelId(selectedModel),
        aspect_ratio: aspectRatio,
        resolution: resolution,
        ref_images: refImages,
        // Auto Inputs
        auto_storyboard: autoStoryboard,
        auto_lighting: autoLighting,
        auto_background: autoBackground,
        auto_characters: autoCharacters,
        // Angles Inputs
        angles_angle: anglesAngle,
        angles_length: anglesLength,
        angles_focus: anglesFocus,
        angles_background: anglesBackground,
        angles_anchor: anglesAnchorFile,
        angles_target: anglesTargetFile
      }).then(async (result) => {
        console.log('Generation initiated:', result);
        if (result.success && shot?.id) {

          // Replace temp item with real item immediately (using known Real ID)
          // This ensures that our local state has the correct ID so when the DB catches up, they match.
          if (result.generation_id) {
            setGenerations(prev => {
              const realItem: Generation = {
                ...tempGen,
                id: result.generation_id,
                status: 'pending' // Still pending
              };
              // Remove temp, add real
              return [realItem, ...prev.filter(g => g.id !== tempId)];
            });
          }

          // Immediately reload to get the "Pending" item from DB (or verifying it)
          await loadGenerations(shot.id);
          // Start Polling
          startPolling(shot.id);
        }
      }).catch((error: any) => {
        console.error('Generation request failed:', error);
        // Remove optimistic item on error
        setGenerations(prev => prev.filter(g => g.id !== tempId));
        const errMsg = error.response?.data?.detail || error.message || 'Unknown error';
        dialog.alert('Error', `Failed to start generation: ${errMsg}`, 'danger');
      });

      // Clear ref images immediately for next run
      setRefImages([]);

      // Allow multiple
      setIsGenerating(false);
    } catch (error) {
      console.error('Preparation failed:', error);
      setIsGenerating(false);
    }
  };

  const handleRefImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setRefImages(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeRefImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropRef = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      setRefImages(prev => [...prev, ...files]);
    }
  };



  const handlePromoteGeneration = async () => {
    if (!selectedGeneration) return;

    dialog.confirm(
      "Promote Generation?",
      "Promote this generation to a new version?",
      async () => {
        try {
          const resp = await fetch(selectedGeneration.image_url);
          const blob = await resp.blob();
          const file = new File([blob], "generated_image.png", { type: "image/png" });

          handleUpload({ target: { files: [file] } } as any);
        } catch (err) {
          console.error("Failed to promote generation", err);
          dialog.alert('Error', "Failed to promote generation", 'danger');
        }
      },
      'info'
    );
  };

  const handleApprovalClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      // Double click logic
      customUploadRef.current?.click();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        // Single click logic
        if (selectedGeneration) {
          handlePromoteGeneration();
        }
      }, 250);
    }
  };

  // Effect to load generations on mount
  useEffect(() => {
    if (shot?.id) {
      loadGenerations(shot.id);
    }
  }, [shot?.id]);

  if (!shot) return <div className="text-white p-8">Loading shot...</div>;

  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* Col 1: Reference */}


      {/* Correct Structure for Col 1 */}
      <div className="w-1/4 border-r border-white/10 p-5 flex flex-col overflow-y-auto bg-zinc-900/50 backdrop-blur-sm z-10 scrollbar-thin scrollbar-thumb-white/10">
        <ReferencePanel
          shot={shot}
          userProfile={userProfile}
          uploadingRefs={uploadingRefs}
          openAccordion={openAccordion}
          toggleAccordion={toggleAccordion}
          handleReferenceUpload={handleReferenceUpload}
          setFullScreenImage={setFullScreenImage}
          setZoomLevel={setZoomLevel}
          navigate={navigate}

          projectId={projectId}
          selectedBackgroundUrl={selectedBackgroundUrl}
          setSelectedBackgroundUrl={setSelectedBackgroundUrl}
        />

        <GenerationTools
          generationMode={generationMode}
          setGenerationMode={setGenerationMode}
          prompt={prompt}
          handlePromptChange={handlePromptChange}
          textareaRef={textareaRef}
          handleDragOver={handleDragOver}
          handleDropRef={handleDropRef}
          showTagMenu={showTagMenu}
          refImages={refImages}
          insertTag={insertTag}
          removeRefImage={removeRefImage}
          refInputRef={refInputRef}
          handleRefImageSelect={handleRefImageSelect}
          selectedAutoTabs={selectedAutoTabs}
          setSelectedAutoTabs={setSelectedAutoTabs}
          fileInputRefs={fileInputRefs}
          handleAutoStoryboardUpload={handleAutoStoryboardUpload}
          autoStoryboardFile={autoStoryboardFile}
          setAutoStoryboardFile={setAutoStoryboardFile}
          shot={shot}

          handleAutoBackgroundUpload={handleAutoBackgroundUpload}
          autoBackgroundFile={autoBackgroundFile}
          setAutoBackgroundFile={setAutoBackgroundFile}
          characterTabs={characterTabs}
          autoCharacterFiles={autoCharacterFiles}
          handleAutoCharacterUpload={handleAutoCharacterUpload}
          removeAutoCharacterFile={removeAutoCharacterFile}
          addCharacterTab={addCharacterTab}
          removeCharacterTab={removeCharacterTab}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          resolution={resolution}
          setResolution={setResolution}
          handleGenerate={handleGenerate}
          isGenerating={isGenerating}
          uploadingRefs={uploadingRefs}
          // Angles Props
          anglesAngle={anglesAngle}
          setAnglesAngle={setAnglesAngle}
          anglesLength={anglesLength}
          setAnglesLength={setAnglesLength}
          anglesFocus={anglesFocus}
          setAnglesFocus={setAnglesFocus}
          anglesBackground={anglesBackground}
          setAnglesBackground={setAnglesBackground}
          anglesAnchorFile={anglesAnchorFile}
          setAnglesAnchorFile={setAnglesAnchorFile}
          handleAnglesAnchorUpload={handleAnglesAnchorUpload}
          anglesTargetFile={anglesTargetFile}
          setAnglesTargetFile={setAnglesTargetFile}
          handleAnglesTargetUpload={handleAnglesTargetUpload}
          // BG Grid
          backgroundGridFile={backgroundGridFile}
          setBackgroundGridFile={setBackgroundGridFile}
          handleBackgroundGridUpload={handleBackgroundGridUpload}
          // Project ID
          projectId={projectId}
          // Character mention
          showCharacterModalFromMention={showCharacterModalFromMention}
          onCharacterMentionSelect={handleCharacterMentionSelect}
          onCloseCharacterMention={() => setShowCharacterModalFromMention(false)}
          selectedCharacters={selectedCharacters}
          setSelectedCharacters={setSelectedCharacters}
        />
      </div>

      <ImageViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState({ ...viewerState, isOpen: false })}
        initialIndex={viewerState.index}
        images={generations.map(g => ({ url: g.image_url, prompt: g.prompt }))}
      />

      <BackgroundGridResultsModal
        isOpen={isBackgroundGridModalOpen}
        onClose={() => setIsBackgroundGridModalOpen(false)}
        urls={backgroundGridResults}
        onSaveToReferences={handleSaveBackgrounds}
      />

      {/* Col 2: Canvas */}
      <div className="w-1/2 border-r border-zinc-700 p-4 flex flex-col relative">
        <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
          <h2 className="text-xl font-bold text-center">
            {shot.name} - {activeVersion ? `v${activeVersion.version_number}` : 'No Version'}
          </h2>
          {activeVersion && (
            <>
              {activeVersion.gdrive_link && (
                <a
                  href={activeVersion.gdrive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  title="Open in Google Drive"
                >
                  <DriveIcon />
                </a>
              )}
              {activeVersion.users?.email && (
                <span className={`text-xs text-zinc-500 ml-2 ${activeVersion.gdrive_link ? 'border-l border-zinc-700 pl-3' : ''}`}>
                  Uploaded by: {activeVersion.users.email}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Version List (Left Side of Canvas) */}
          <div className="w-20 flex flex-col gap-2 overflow-y-auto pr-2">
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => { setActiveVersion(v); fetchReview(v.id); setSelectedGeneration(null); }}
                className={`
                  aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all
                  ${activeVersion?.id === v.id ? 'border-white-500 bg-white-900/20 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500'}
                `}
              >
                v{v.version_number}
              </button>
            ))}
          </div>

          {/* Main Player */}
          <MainPlayer
            selectedGeneration={selectedGeneration}
            activeVersion={activeVersion}
            setFullScreenImage={setFullScreenImage}
            setZoomLevel={setZoomLevel}
          />
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          {uploadStatus === 'uploading' && (
            <div className="w-full max-w-xs bg-zinc-800 rounded-full h-2.5 mb-2 overflow-hidden border border-zinc-700">
              <div
                className="bg-brand-white h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <span className="text-[10px] text-zinc-500 mt-1 block text-center">
                Uploading: {uploadProgress}%
              </span>
            </div>
          )}

          {canUploadVersion() ? (
            <div className="w-full flex flex-col gap-4">
              {/* Generations Slider */}
              <GenerationsSlider
                generations={generations}
                selectedGeneration={selectedGeneration}
                setSelectedGeneration={setSelectedGeneration}
                onRestore={handleRestore}
              />

              {/* Send for Approval Button */}
              <div className="flex flex-col items-center">
                <input
                  type="file"
                  ref={customUploadRef}
                  className="hidden"
                  onChange={handleUpload}
                  accept="image/*"
                />
                <button
                  onClick={handleApprovalClick}
                  disabled={uploadStatus === 'uploading'}
                  className={`
                    group relative px-10 py-4 rounded-full font-bold text-base uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-md
                    ${selectedGeneration
                      ? 'bg-gradient-to-br from-white/20 via-white/10 to-transparent text-white border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:bg-white/20 hover:scale-105'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed'
                    }
                  `}
                  title="Single Click: Promote Selected | Double Click: Upload Custom"
                >
                  {/* Glass Shine Effect */}
                  {selectedGeneration && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent opacity-50 pointer-events-none" />
                  )}

                  {uploadStatus === 'uploading' ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} className={selectedGeneration ? "fill-white/50 text-white" : ""} />
                      Send for Approval
                    </>
                  )}
                </button>
                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                  Single-click to promote selection â€¢ Double-click to upload file
                </p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-3 bg-zinc-800 text-zinc-500 rounded font-bold cursor-not-allowed border border-zinc-700">
              Upload Restricted
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Zoom Modal */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Toolbar */}
          <div className="h-16 flex items-center justify-between px-6 bg-black/50 absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 font-mono">{Math.round(zoomLevel * 100)}%</span>
            </div>
            <button
              onClick={() => setFullScreenImage(null)}
              className="p-2 bg-red-600 rounded hover:bg-red-700 text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <DriveImage
              src={fullScreenImage}
              alt="Full Screen"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease-out',
                cursor: zoomLevel > 1 ? 'grab' : 'default'
              }}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Col 3: Feedback */}

      <FeedbackPanel
        activeVersion={activeVersion}
        review={review}
        userProfile={userProfile}
        handleVote={handleVote}
        handleCommentSave={handleCommentSave}
        pmCommentRef={pmCommentRef}
        cdCommentRef={cdCommentRef}
      />
    </div >
  );
};
