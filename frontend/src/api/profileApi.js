import axiosClient from './axiosClient';

export async function getProfile() {
  const response = await axiosClient.get('/users/profile');
  return response.data;
}

export async function updateProfile({ fullName }) {
  const response = await axiosClient.put('/users/profile', {
    full_name: fullName,
  });
  return response.data;
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.put('/users/profile/avatar', formData);
  return response.data;
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  const response = await axiosClient.put('/users/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
  return response.data;
}
