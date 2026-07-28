import axiosClient from './axiosClient';

export async function getHelpGuides() {
  const response = await axiosClient.get('/help/guides');
  return response.data;
}

export async function getHelpGuide(slug) {
  const response = await axiosClient.get(`/help/guides/${encodeURIComponent(slug)}`);
  return response.data;
}

export async function askTaskFlowAI(payload) {
  const response = await axiosClient.post('/help/ai-chat', payload);
  return response.data;
}
