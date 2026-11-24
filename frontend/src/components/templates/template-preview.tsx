import { CollapsibleCard } from '@/components/common/collapsible-card';
import { TemplatePlaceholder } from '@/components/experiments/template/template-placeholder';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';

import type { TemplateComponent, TemplateTab } from '@/lib/types/templates.ts';
import {
  COMPONENT_DESCRIPTIONS,
  COMPONENT_LABELS,
  STOICHIOMETRY_PART_LABELS,
  STOICHIOMETRY_PARTS,
} from '@/lib/types/templates.ts';

/** The blocks a stoichiometry table was built with, each where the experiment will draw it. */
function ComponentBody({ component }: { component: TemplateComponent }) {
  if (component.type !== 'stoichiometryTable') {
    return <TemplatePlaceholder>{COMPONENT_DESCRIPTIONS[component.type]}</TemplatePlaceholder>;
  }
  return (
    <div className="flex flex-col gap-3">
      {STOICHIOMETRY_PARTS.filter((part) => component[part]).map((part) => (
        <TemplatePlaceholder key={part}>{STOICHIOMETRY_PART_LABELS[part]}</TemplatePlaceholder>
      ))}
    </div>
  );
}

/**
 * What an experiment built on the template will look like: its tabs, and in each the components
 * in order, in the cards the experiment screen puts them in.
 *
 * The cards hold outlines rather than the real panels. Those read and write an experiment — its
 * attachments, batches, history — and a template has none, so mounting them here would fire
 * requests for an experiment that does not exist.
 */
export function TemplatePreview({ tabs }: { tabs: readonly TemplateTab[] }) {
  return (
    <Tabs defaultValue={0} className="rounded-6 bg-card p-4 shadow-card">
      <TabsList>
        {tabs.map((tab, index) => (
          // By position: two tabs may share a name.
          <TabsTab key={index} value={index}>
            {tab.name}
          </TabsTab>
        ))}
      </TabsList>
      {tabs.map((tab, index) => (
        <TabsPanel key={index} value={index} className="gap-4">
          {tab.components.length === 0 ? (
            <TemplatePlaceholder>This tab has no components yet.</TemplatePlaceholder>
          ) : (
            tab.components.map((component) => (
              <CollapsibleCard
                key={component.type}
                title={COMPONENT_LABELS[component.type]}
                className="border border-neutral-300 shadow-none"
              >
                <ComponentBody component={component} />
              </CollapsibleCard>
            ))
          )}
        </TabsPanel>
      ))}
    </Tabs>
  );
}
