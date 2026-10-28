import React, { useState } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';

interface TraderProfileModalProps {
  firstName: string;
  lastName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (firstName: string, lastName: string) => Promise<boolean>;
}

export default function TraderProfileModal({
  firstName,
  lastName,
  isOpen,
  onClose,
  onSave
}: TraderProfileModalProps) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return;

    setIsSaving(true);
    const success = await onSave(first.trim(), last.trim());
    setIsSaving(false);

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#0f172a] border border-neutral-800 rounded-xl w-full max-w-md p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold">Trader Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-neutral-400 mb-4">
          The trader name is a required root property in the <code>trading_manifest_schema_8ef33500.json</code> specification.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Trader First Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Trader Last Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save &amp; Update Manifest</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
