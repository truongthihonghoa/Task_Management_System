import React, { useEffect, useState } from 'react';
 
const CreateSpaceModal = ({ isOpen, onClose, onCreate, currentUser, isSubmitting = false, submitError = '' }) => {
  const [formData, setFormData] = useState({
    title: '',
    key: '',
    description: ''
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocalError('');
    }
  }, [isOpen]);
 
  if (!isOpen) return null;
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const title = formData.title.trim();
    const key = formData.key.trim().toUpperCase();
    if (!title) {
      setLocalError('Space name is required.');
      return;
    }
    if (!/^[A-Z][A-Z0-9]{0,9}$/.test(key)) {
      setLocalError('Space key must start with a letter and contain only letters/numbers.');
      return;
    }

    try {
      await onCreate({
        ...formData,
        title,
        key,
        owner: currentUser?.id,
        ownerName: currentUser?.name
      });
      setFormData({ title: '', key: '', description: '' });
    } catch (error) {
      setLocalError(error?.message || 'Unable to create this space.');
    }
  };
 
  return (
    <div className="space-create-modal fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="space-create-modal__panel bg-white w-[400px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-create-modal__header px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#fcfaff]">
          <h2 className="space-create-modal__title text-[16px] font-bold text-[#4C2B74]">Create New Space</h2>
          <button onClick={onClose} className="space-create-modal__close text-gray-400 hover:text-gray-600 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-create-modal__form p-6">
          <div className="mb-4">
            <label className="space-create-modal__label block text-[11px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">Space Name</label>
            <input
              type="text"
              required
              className="space-create-modal__input w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#4C2B74]/20 focus:border-[#4C2B74] transition-all"
              placeholder="e.g. Marketing Campaign"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="space-create-modal__label block text-[11px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">Space Key</label>
            <input
              type="text"
              required
              maxLength={10}
              pattern="[A-Za-z][A-Za-z0-9]{0,9}"
              className="space-create-modal__input w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] uppercase outline-none focus:ring-2 focus:ring-[#4C2B74]/20 focus:border-[#4C2B74] transition-all"
              placeholder="e.g. EC"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            />
          </div>

          <div className="mb-6">
            <label className="space-create-modal__label block text-[11px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">Description (Optional)</label>
            <textarea
              rows="3"
              className="space-create-modal__input w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#4C2B74]/20 focus:border-[#4C2B74] transition-all resize-none"
              placeholder="What is this space for?"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {(localError || submitError) && (
            <div className="space-create-modal__error mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
              {localError || submitError}
            </div>
          )}

          <div className="space-create-modal__actions flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="space-create-modal__cancel flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-500 hover:bg-gray-100 transition-all border border-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="space-create-modal__submit flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#4C2B74] hover:bg-[#3D225E] transition-all shadow-md shadow-purple-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Creating...' : 'Create Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
 
export default CreateSpaceModal;
//
