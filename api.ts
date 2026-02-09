import axios from 'axios';

const API_URL = 'https://itoolback.onrender.com/';

const api = axios.create({
  baseURL: API_URL,
});

export const createStructure = async (payload: {
  name: string;
  type: 'project' | 'scene' | 'shot';
  parentFolderId?: string;
  parentDbId?: string;
  assignTo?: string;
}) => {
  const response = await api.post('/structure', payload);
  return response.data;
};

export const uploadAsset = async (payload: {
  file: File;
  folder_id: string;
  db_id: string;
  uploader_id: string;
  is_storyboard?: boolean;
  reference_type?: string;
  asset_type?: string;
  resource_type?: string;
}, onUploadProgress?: (progressEvent: any) => void) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value as any);
    }
  });

  const response = await api.post('/assets/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
  return response.data;
};

export const setActiveVersion = async (payload: {
  version_id: string;
  shot_name: string;
  folder_id: string;
}) => {
  const response = await api.post('/assets/set_active_version', {
    version_id: payload.version_id,
    shot_name: payload.shot_name,
    target_folder_id: payload.folder_id
  });
  return response.data;
};

export const generateImage = async (payload: {
  prompt: string;
  mode: 'manual' | 'automatic' | 'storyboard_enhancer' | 'angles';
  shot_id: string;
  user_email: string;
  model: string;
  aspect_ratio: string;
  resolution?: string;
  ref_images?: File[];
  auto_storyboard?: File | null;
  auto_lighting?: File | null;
  auto_background?: File | null;
  auto_characters?: File[];
  // Angles Mode
  angles_angle?: string;
  angles_length?: string;
  angles_focus?: string;
  angles_background?: string;
  angles_anchor?: File | null;
  angles_target?: File | null;
}) => {
  const formData = new FormData();
  formData.append('prompt', payload.prompt);
  formData.append('mode', payload.mode);
  formData.append('shot_id', payload.shot_id);
  formData.append('user_email', payload.user_email);
  formData.append('model', payload.model);
  formData.append('aspect_ratio', payload.aspect_ratio);
  if (payload.resolution) formData.append('resolution', payload.resolution);

  // Manual Mode Images
  if (payload.ref_images) {
    payload.ref_images.forEach((file) => {
      formData.append('ref_images', file);
    });
  }

  // Automatic Mode Images
  if (payload.auto_storyboard) {
    formData.append('auto_storyboard', payload.auto_storyboard);
  }
  if (payload.auto_lighting) {
    formData.append('auto_lighting', payload.auto_lighting);
  }
  if (payload.auto_background) {
    formData.append('auto_background', payload.auto_background);
  }
  if (payload.auto_characters && payload.auto_characters.length > 0) {
    payload.auto_characters.forEach((file) => {
      formData.append('auto_characters', file);
    });
  }

  // Angles Mode Inputs
  if (payload.angles_angle) formData.append('angles_angle', payload.angles_angle);
  if (payload.angles_length) formData.append('angles_length', payload.angles_length);
  if (payload.angles_focus) formData.append('angles_focus', payload.angles_focus);
  if (payload.angles_background) formData.append('angles_background', payload.angles_background);
  if (payload.angles_anchor) formData.append('angles_anchor', payload.angles_anchor);
  if (payload.angles_target) formData.append('angles_target', payload.angles_target);

  const response = await api.post('/generation/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const fetchGenerations = async (shotId: string) => {
  const response = await api.get(`/generation/${shotId}`);
  return response.data;
};

export const generateBackgroundGrid = async (payload: {
  background_image: File;
  context?: string;
  shot_id: string;
  user_email: string;
  aspect_ratio: string;
}) => {
  const formData = new FormData();
  formData.append('background_image', payload.background_image);
  if (payload.context) formData.append('context', payload.context);
  formData.append('shot_id', payload.shot_id);
  formData.append('user_email', payload.user_email);
  formData.append('aspect_ratio', payload.aspect_ratio);

  const response = await api.post('/generation/background-grid', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteProject = async (projectId: string) => {
  const response = await api.delete(`/structure/project/${projectId}`);
  return response.data;
};

export const verifyDeleteProject = async (projectId: string, password: string) => {
  const response = await api.post(`/structure/project/${projectId}/confirm`, { password });
  return response.data;
};

export default api;