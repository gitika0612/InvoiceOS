import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteInvoiceModalProps {
  invoiceNumber: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteInvoiceModal({
  invoiceNumber,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteInvoiceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isDeleting ? onCancel : undefined}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-3xl w-full max-w-sm mx-4 overflow-hidden"
        style={{
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* Red top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-red-400 to-red-600" />

        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 border border-red-100 mx-auto mb-5">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>

          {/* Text */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">
              Delete Invoice
            </h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              You are about to permanently delete
            </p>
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-gray-100 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span className="text-sm font-bold text-gray-800">
                {invoiceNumber}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              This action is irreversible and cannot be undone.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                boxShadow: "0 4px 12px rgba(239,68,68,0.4)",
              }}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
