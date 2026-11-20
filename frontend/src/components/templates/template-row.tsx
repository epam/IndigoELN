import { Link } from '@tanstack/react-router';
import { Eye, LayoutTemplate, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { LabelledColumn } from '@/components/common/labelled-column';
import { DeleteTemplateDialog } from '@/components/templates/delete-template-dialog';
import { TemplateNameInput } from '@/components/templates/template-name-input';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { useDeleteTemplate, useRenameTemplate } from '@/lib/api/templates';

import type { Template } from '@/lib/types/templates.ts';
import { formatDate } from '@/lib/utils.ts';

/** The same column grid as `DictionaryRow` and `ProjectRow`. */
const COLUMNS_CLASS = 'grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]';

/**
 * One template in the list: the whole card opens it, as a `ProjectRow` does, and its "…" menu
 * offers what the design puts there — Preview, Rename in place, Delete.
 *
 * The card is not one `<Link>`, because the menu button would then sit inside an anchor. The link
 * is the name, stretched over the card by its `::after`; the menu is lifted above it.
 */
export function TemplateRow({ template, existingNames }: { template: Template; existingNames: readonly string[] }) {
  const rename = useRenameTemplate();
  const remove = useDeleteTemplate();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <article className="relative flex flex-col gap-3 rounded-6 border border-neutral-300 bg-card px-4 pt-3 pb-4 focus-within:ring-3 focus-within:ring-ring/50 has-[input]:focus-within:ring-0">
      <header className="flex min-h-7 items-center gap-4">
        <LayoutTemplate aria-hidden className="size-5 shrink-0 text-neutral-800" />
        {renaming ? (
          <TemplateNameInput
            name={template.name}
            existingNames={existingNames}
            className="relative z-10 flex-1"
            onCancel={() => setRenaming(false)}
            onSave={async (name) => {
              await rename.mutateAsync({ id: template.id, name });
              setRenaming(false);
            }}
          />
        ) : (
          <h3 className="flex-1 truncate text-[14px]/5 font-semibold">
            <Link
              to="/templates/$id"
              params={{ id: template.id }}
              className="outline-none after:absolute after:inset-0 after:rounded-6"
            >
              {template.name}
            </Link>
          </h3>
        )}
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${template.name}`}
                className="relative z-10 text-neutral-800"
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <MenuContent>
            <MenuItem render={<Link to="/templates/$id" params={{ id: template.id }} search={{ view: 'preview' }} />}>
              <Eye className="size-4" />
              Preview
            </MenuItem>
            <MenuItem onClick={() => setRenaming(true)}>
              <Pencil className="size-4" />
              Rename
            </MenuItem>
            <MenuItem onClick={() => setDeleting(true)}>
              <Trash2 className="size-4" />
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <dl className={COLUMNS_CLASS}>
        <LabelledColumn label="Created by">
          <Avatar displayName={template.createdBy.displayName} aria-hidden />
          <span className="truncate">{template.createdBy.displayName}</span>
        </LabelledColumn>
        <LabelledColumn label="Created">
          <span className="truncate">
            {formatDate(template.createdAt)} by {template.createdBy.displayName}
          </span>
        </LabelledColumn>
        <LabelledColumn label="Last Edited">
          <span className="truncate">
            {formatDate(template.modifiedAt)} by {template.modifiedBy.displayName}
          </span>
        </LabelledColumn>
      </dl>

      <DeleteTemplateDialog
        name={template.name}
        open={deleting}
        onOpenChange={setDeleting}
        onSubmit={async () => {
          await remove.mutateAsync(template.id);
          setDeleting(false);
        }}
      />
    </article>
  );
}
