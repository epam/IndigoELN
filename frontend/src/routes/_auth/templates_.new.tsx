import { createFileRoute, redirect, useBlocker } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useRef, useState } from 'react';

import { RequirePermission } from '@/components/auth/require-permission';
import { FormDialog } from '@/components/common/form-dialog';
import { TemplateConstructor } from '@/components/templates/template-constructor';
import { EMPTY_TEMPLATE, tabError, TEMPLATE_VIEWS, toTemplateRequest } from '@/components/templates/template-form';
import { TemplateLayout } from '@/components/templates/template-layout';
import { TemplateNameInput } from '@/components/templates/template-name-input';
import { TemplatePreview } from '@/components/templates/template-preview';
import { Button } from '@/components/ui/button';
import { useCreateTemplate, useTemplateNames } from '@/lib/api/templates';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { z } from '@/lib/zod';

import type { TemplateTab } from '@/lib/types/templates.ts';

/** The name comes from Add Template; there is no building a template without one. */
const searchSchema = z.object({
  name: z.string().optional(),
  view: z.enum(TEMPLATE_VIEWS).default('constructor'),
});

export const Route = createFileRoute('/_auth/templates_/new')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.name?.trim()) throw redirect({ to: '/templates' });
  },
  component: () => (
    <RequirePermission permission="MANAGE_TEMPLATES">
      <NewTemplatePage />
    </RequirePermission>
  ),
});

/**
 * A template being built. Nothing exists on the server until Save: `POST /templates` takes the
 * name and every tab at once, and `PATCH` will change only the name afterwards — so this is the
 * one place the structure is decided, and the draft lives here, in the page, until then.
 *
 * Leaving with tabs built asks first, since they are nowhere else.
 */
function NewTemplatePage() {
  const { name = '', view } = Route.useSearch();
  const navigate = Route.useNavigate();
  usePageTitle(`New Template ${name}`);

  const [tabs, setTabs] = useState<TemplateTab[]>(() => [...EMPTY_TEMPLATE]);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // A ref, not state: the navigation after Save runs in the same tick, before any re-render could
  // hand the blocker a fresh closure.
  const saved = useRef(false);
  const create = useCreateTemplate();
  const { names: existingNames } = useTemplateNames();

  const touched = tabs.some((tab) => tab.components.length > 0) || tabs.length > 1;
  // Switching Constructor and Preview, or renaming, stays on this route and is never held up.
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => touched && !saved.current && next.pathname !== '/templates/new',
    enableBeforeUnload: () => touched && !saved.current,
    withResolver: true,
  });

  const valid = tabs.length > 0 && tabs.every((tab) => tabError(tab) === undefined);

  async function save() {
    setSaveAttempted(true);
    if (!valid) {
      void navigate({ search: (prev) => ({ ...prev, view: 'constructor' }), replace: true });
      return;
    }
    const created = await create.mutateAsync(toTemplateRequest(name, tabs));
    saved.current = true;
    void navigate({ to: '/templates/$id', params: { id: created.id }, replace: true });
  }

  return (
    <>
      <TemplateLayout
        view={view}
        onViewChange={(next) => void navigate({ search: (prev) => ({ ...prev, view: next }), replace: true })}
        title={
          renaming ? (
            <TemplateNameInput
              name={name}
              existingNames={existingNames}
              onCancel={() => setRenaming(false)}
              onSave={async (next) => {
                setRenaming(false);
                await navigate({ search: (prev) => ({ ...prev, name: next }), replace: true });
              }}
            />
          ) : (
            <div className="flex items-center gap-1">
              <h1 className="truncate text-[16px]/6 font-semibold">{name}</h1>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rename template"
                onClick={() => setRenaming(true)}
                className="text-blue-400"
              >
                <Pencil />
              </Button>
            </div>
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              className="rounded-md"
              onClick={() => void navigate({ to: '/templates' })}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="rounded-md"
              loading={create.isPending}
              onClick={() => void save().catch(() => undefined)}
            >
              Save
            </Button>
          </>
        }
        constructorPanel={<TemplateConstructor tabs={tabs} onChange={setTabs} showErrors={saveAttempted} />}
        previewPanel={<TemplatePreview tabs={tabs} />}
      />
      <FormDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Discard Template"
        submitLabel="Discard"
        submitVariant="destructive"
        onSubmit={async () => blocker.proceed?.()}
      >
        <p className="text-[14px]/6 text-neutral-800">
          This template has not been saved. Leave and lose its tabs and components?
        </p>
      </FormDialog>
    </>
  );
}
