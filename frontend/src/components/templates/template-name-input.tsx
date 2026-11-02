import { useState } from 'react';

import { templateNameError } from '@/components/templates/template-form';
import { Input } from '@/components/ui/input';
import { TEMPLATE_NAME_MAX_LENGTH } from '@/lib/types/templates.ts';

/**
 * A template's name, edited where it is shown — the row in the list, the template page's title —
 * as the design renames it, rather than in a dialog.
 *
 * Enter or leaving the box saves, Escape gives up. A name that cannot be used says why under the
 * box and keeps it open; leaving it unchanged, or emptied, simply gives up, so a stray click away
 * never costs a request. A rejected save keeps the box open too, with what was typed.
 */
export function TemplateNameInput({
  name,
  existingNames,
  onSave,
  onCancel,
  className,
}: {
  name: string;
  existingNames: readonly string[];
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const error = templateNameError(value, existingNames, name);

  async function commit() {
    const trimmed = value.trim();
    if (saving) return;
    if (trimmed === name || trimmed === '') {
      onCancel();
      return;
    }
    if (error) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch {
      // Stays open with what was typed; the failure is toasted by the mutation cache.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <Input
        // The box replaces the text the user just asked to change, so it is where their focus goes.
        autoFocus
        aria-label="Template Name"
        aria-invalid={error !== undefined}
        aria-describedby={error ? 'template-name-error' : undefined}
        value={value}
        maxLength={TEMPLATE_NAME_MAX_LENGTH}
        disabled={saving}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        className="h-8"
      />
      {error && (
        <p id="template-name-error" role="alert" className="pt-1 text-[12px]/5 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
