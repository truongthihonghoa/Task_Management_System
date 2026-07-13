import React, { useState } from 'react';
 
const CreateSpaceModal = ({ isOpen, onClose, onCreate, currentUser }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
 
  if (!isOpen) return null;
 
  const handleSubmit = (e) => {
    e.preventDefault();
    // Include owner information when creating space
    onCreate({
      ...formData,
      owner: currentUser?.id,
      ownerName: currentUser?.name
    });
    onClose();
    setFormData({ title: '', description: '' });
  };
 
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white w-[400px] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#fcfaff]">
          <h2 className="text-[16px] font-bold text-[#4C2B74]">Create New Space</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
 
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">Space Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#4C2B74]/20 focus:border-[#4C2B74] transition-all"
              placeholder="e.g. Marketing Campaign"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              autoFocus
            />
          </div>
 
          <div className="mb-6">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 ml-0.5">Description (Optional)</label>
            <textarea
              rows="3"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#4C2B74]/20 focus:border-[#4C2B74] transition-all resize-none"
              placeholder="What is this space for?"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
 
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-gray-500 hover:bg-gray-100 transition-all border border-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#4C2B74] hover:bg-[#3D225E] transition-all shadow-md shadow-purple-200 active:scale-95"
            >
              Create Space
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
 
export default CreateSpaceModal;
//