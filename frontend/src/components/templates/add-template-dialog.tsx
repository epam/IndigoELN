import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';

import { FormDialog } from '@/components/common/form-dialog';
import { templateNameError } from '@/components/templates/template-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { TEMPLATE_NAME_MAX_LENGTH } from '@/lib/types/templates.ts';

/**
 * Add Template, as the design has it: a name and nothing else. Nothing is created here —
 * `POST /templates` wants the tabs as well, so `onSubmit` hands the name on to the constructor,
 * where the template is built and saved in one go.
 *
 * The name is checked against `existingNames`, the list the page already holds, so a taken one
 * is refused before any tabs are built around it — which is why `initializing` holds Save until
 * that list has loaded.
 */
export function AddTemplateDialog({
  open,
  onOpenChange,
  existingNames,
  initializing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: readonly string[];
  initializing?: boolean;
  onSubmit: (name: string) => void;
}) {
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: ({ value }) => {
      onOpenChange(false);
      onSubmit(value.name.trim());
    },
  });

  // Mounted between openings, so each one starts blank.
  useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  return (
    <form.Subscribe selector={(state) => !state.canSubmit || state.isValidating}>
      {(submitDisabled) => (
        <FormDialog
          open={open}
          onOpenChange={onOpenChange}
          title="Add Template"
          submitDisabled={submitDisabled}
          initializing={initializing}
          onSubmit={() => form.handleSubmit()}
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => templateNameError(value, existingNames),
              onSubmit: ({ value }) => templateNameError(value, existingNames),
            }}
          >
            {(field) => (
              <Field
                id="template-name"
                label="Template Name"
                required
                error={field.state.meta.isTouched ? field.state.meta.errors[0] : undefined}
              >
                <Input
                  id="template-name"
                  name={field.name}
                  value={field.state.value}
                  placeholder="Template Name"
                  maxLength={TEMPLATE_NAME_MAX_LENGTH}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
        </FormDialog>
      )}
    </form.Subscribe>
  );
}
