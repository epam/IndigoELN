import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';

import type { TemplateView } from '@/components/templates/template-form';

/**
 * A template's page, saved or still being built: back to the list, the name and what can be done
 * with it, and the Constructor and Preview tabs the design puts under them.
 *
 * The tab is the route's `?view=`, so a Preview link from the list lands on it.
 */
export function TemplateLayout({
  title,
  actions,
  view,
  onViewChange,
  constructorPanel,
  previewPanel,
}: {
  title: ReactNode;
  actions?: ReactNode;
  view: TemplateView;
  onViewChange: (view: TemplateView) => void;
  constructorPanel: ReactNode;
  previewPanel: ReactNode;
}) {
  return (
    <Tabs value={view} onValueChange={(next: TemplateView) => onViewChange(next)}>
      <section className="flex flex-col gap-2 rounded-6 bg-card px-4 pt-4 shadow-card">
        <div className="flex min-h-9 items-center gap-2">
          <Link
            to="/templates"
            aria-label="All Templates"
            className="rounded-2 p-1 text-neutral-800 outline-none hover:text-neutral-1000 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">{title}</div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        <TabsList className="border-b-0">
          <TabsTab value="constructor">Constructor</TabsTab>
          <TabsTab value="preview">Preview</TabsTab>
        </TabsList>
      </section>
      <TabsPanel value="constructor">{constructorPanel}</TabsPanel>
      <TabsPanel value="preview">{previewPanel}</TabsPanel>
    </Tabs>
  );
}
