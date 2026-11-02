import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { RequirePermission } from '@/components/auth/require-permission';
import { DeleteTemplateDialog } from '@/components/templates/delete-template-dialog';
import { TemplateConstructor } from '@/components/templates/template-constructor';
import { TEMPLATE_VIEWS } from '@/components/templates/template-form';
import { TemplateLayout } from '@/components/templates/template-layout';
import { TemplateNameInput } from '@/components/templates/template-name-input';
import { TemplatePreview } from '@/components/templates/template-preview';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteTemplate, useRenameTemplate, useTemplate, useTemplates } from '@/lib/api/templates';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { z } from '@/lib/zod';

const searchSchema = z.object({
  view: z.enum(TEMPLATE_VIEWS).default('constructor'),
});

export const Route = createFileRoute('/_auth/templates_/$id')({
  validateSearch: searchSchema,
  component: () => (
    <RequirePermission permission="MANAGE_TEMPLATES">
      <TemplatePage />
    </RequirePermission>
  ),
});

/**
 * A saved template: renamed or deleted from its header, its structure shown in the constructor
 * but not changed there — `PATCH /templates/{id}` takes the name alone — and previewed.
 */
function TemplatePage() {
  const { id } = Route.useParams();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: template, isPending, isError } = useTemplate(id);
  usePageTitle(template && `Template ${template.name}`);

  const rename = useRenameTemplate();
  const remove = useDeleteTemplate();
  const all = useTemplates(true);
  const existingNames = useMemo(() => (all.data?.items ?? []).map((item) => item.name), [all.data]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">Loading template…</span>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    return <p className="text-[14px]/6 text-destructive">This template could not be loaded.</p>;
  }

  return (
    <>
      <TemplateLayout
        view={view}
        onViewChange={(next) => void navigate({ search: { view: next }, replace: true })}
        title={
          renaming ? (
            <TemplateNameInput
              name={template.name}
              existingNames={existingNames}
              onCancel={() => setRenaming(false)}
              onSave={async (name) => {
                await rename.mutateAsync({ id, name });
                setRenaming(false);
              }}
            />
          ) : (
            <h1 className="truncate text-[16px]/6 font-semibold">{template.name}</h1>
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Rename template"
              disabled={renaming}
              onClick={() => setRenaming(true)}
              className="text-blue-400"
            >
              <Pencil />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Delete template"
              onClick={() => setDeleting(true)}
              className="text-destructive"
            >
              <Trash2 />
            </Button>
          </>
        }
        constructorPanel={<TemplateConstructor tabs={template.templateTabs} />}
        previewPanel={<TemplatePreview tabs={template.templateTabs} />}
      />
      <DeleteTemplateDialog
        name={template.name}
        open={deleting}
        onOpenChange={setDeleting}
        onSubmit={async () => {
          await remove.mutateAsync(id);
          setDeleting(false);
          void navigate({ to: '/templates', replace: true });
        }}
      />
    </>
  );
}
