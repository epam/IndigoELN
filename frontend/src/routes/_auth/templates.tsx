import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { RequirePermission } from '@/components/auth/require-permission';
import { ActionBar } from '@/components/common/action-bar';
import { AddTemplateDialog } from '@/components/templates/add-template-dialog';
import { TemplateList } from '@/components/templates/template-list';
import { Button } from '@/components/ui/button';
import { useFilteredTemplates, useTemplateNames } from '@/lib/api/templates';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { z } from '@/lib/zod';
import { SORT_ORDERS, type SortOrder } from '@/lib/types/common.ts';

/** No `view`: the list has one layout, as the signatures list does. */
const searchSchema = z.object({
  q: z.string().optional(),
  sort: z.enum(SORT_ORDERS).default('LATEST'),
  createdByMe: z.boolean().default(false),
});

export const Route = createFileRoute('/_auth/templates')({
  validateSearch: searchSchema,
  component: () => (
    <RequirePermission permission="MANAGE_TEMPLATES">
      <TemplatesPage />
    </RequirePermission>
  ),
});

/**
 * Template management: the list, and Add Template.
 *
 * Gated on the global `MANAGE_TEMPLATES` as a whole. Reading templates needs nothing — Add
 * Experiment lists them for everyone — but this is the screen for managing them, and every write
 * it offers is refused without that permission (`TemplateService`). Like Dictionaries behind
 * `MANAGE_DICTIONARIES`, it is an admin's page, not a reader's.
 */
function TemplatesPage() {
  usePageTitle('Templates');
  const { q, sort, createdByMe } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  const query = useFilteredTemplates({ search: q ?? '', sort, createdByMe });
  const { names: existingNames, isPending: namesPending } = useTemplateNames();

  // replace: keystrokes and toggles should not each become a history entry.
  const patch = (next: Partial<z.infer<typeof searchSchema>>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[16px]/6 font-semibold">Templates</h1>
        <Button size="lg" className="rounded-md" onClick={() => setAddOpen(true)}>
          <Plus />
          Add Template
        </Button>
      </div>
      <ActionBar
        entityLabel="templates"
        search={q ?? ''}
        sort={sort}
        createdByMe={createdByMe}
        onSearchChange={(value) => patch({ q: value || undefined })}
        onSortChange={(value: SortOrder) => patch({ sort: value })}
        onCreatedByMeChange={(value) => patch({ createdByMe: value })}
      />
      <TemplateList query={query} existingNames={existingNames} />
      <AddTemplateDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingNames={existingNames}
        initializing={namesPending}
        // Nothing is saved yet: the constructor builds the tabs, and Save there creates it.
        onSubmit={(name) => void navigate({ to: '/templates/new', search: { name } })}
      />
    </>
  );
}
