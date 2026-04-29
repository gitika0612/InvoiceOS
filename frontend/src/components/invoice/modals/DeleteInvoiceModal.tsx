import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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
    <AlertDialog
      open={true}
      onOpenChange={(open) => !open && !isDeleting && onCancel()}
    >
      <AlertDialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden gap-0">
        {/* Red top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-red-400 to-red-600" />

        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 border border-red-100 mx-auto mb-5">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>

          <AlertDialogHeader className="text-center space-y-0 mb-6">
            <AlertDialogTitle className="text-lg font-bold text-gray-900 tracking-tight flex items-center justify-center">
              Delete Invoice
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-2 mt-2">
                <p className="text-sm text-gray-500 leading-relaxed">
                  You are about to permanently delete
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span className="text-sm font-bold text-gray-800">
                    {invoiceNumber}
                  </span>
                </div>
                <p className="text-xs text-gray-400 pt-1">
                  This action is irreversible and cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 h-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white h-auto gap-2"
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
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
