import { FormDialog } from '@/components/common/form-dialog';

/**
 * Asks before deleting a template. The page does the deleting, so it can navigate away from a
 * template that no longer exists; a rejected `onSubmit` keeps the dialog open.
 */
export function DeleteTemplateDialog({
  name,
  open,
  onOpenChange,
  onSubmit,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Template"
      submitLabel="Delete"
      submitVariant="destructive"
      onSubmit={onSubmit}
    >
      <p className="text-[14px]/6 text-neutral-800">
        Are you sure you want to delete the template <span className="font-semibold">{name}</span>? A template that
        experiments were created from cannot be deleted.
      </p>
    </FormDialog>
  );
}
