import React from 'react';

/**
 * ImportConfirmModal - Confirmation modal for data import with warning
 */
export const ImportConfirmModal = ({
  isOpen,
  importData,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !importData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">Confirm Import</h2>
        <p className="text-red-400 font-semibold mb-4">
          Warning: This will replace ALL existing data!
        </p>
        <p className="text-gray-300 mb-4">
          The backup file contains:
        </p>
        <ul className="list-disc list-inside text-gray-300 mb-4">
          <li>{importData.counts?.hands || importData.data?.hands?.length || 0} hands</li>
          <li>{importData.counts?.sessions || importData.data?.sessions?.length || 0} sessions</li>
          <li>{importData.counts?.players || importData.data?.players?.length || 0} players</li>
        </ul>
        {importData.exportedAtISO && (
          <p className="text-sm text-gray-500 mb-4">
            Exported: {new Date(importData.exportedAtISO).toLocaleString()}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Import & Replace
          </button>
        </div>
      </div>
    </div>
  );
};

