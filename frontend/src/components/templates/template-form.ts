import { z } from '@/lib/zod';

import type {
  StoichiometryPart,
  TemplateComponent,
  TemplateComponentType,
  TemplateRequest,
  TemplateTab,
} from '@/lib/types/templates.ts';
import { TEMPLATE_COMPONENT_TYPES, TEMPLATE_NAME_MAX_LENGTH } from '@/lib/types/templates.ts';

const templateNameSchema = z
  .string()
  .trim()
  .min(1, 'Template Name is required')
  .max(TEMPLATE_NAME_MAX_LENGTH, `Use ${TEMPLATE_NAME_MAX_LENGTH} characters at most`);

/**
 * Why a template name cannot be used, or undefined. `existing` is the list the page already has;
 * `current` is the template's own name when renaming, which is never taken by itself.
 */
export function templateNameError(name: string, existing: readonly string[], current?: string): string | undefined {
  const parsed = templateNameSchema.safeParse(name);
  if (!parsed.success) return parsed.error.issues[0]?.message;
  if (parsed.data === current) return undefined;
  // The backend's unique constraint answers too, but only once Save has been pressed.
  return existing.includes(parsed.data) ? `Template '${parsed.data}' already exists` : undefined;
}

/** The two tabs of a template's page, as its `?view=` names them. */
export const TEMPLATE_VIEWS = ['constructor', 'preview'] as const;
export type TemplateView = (typeof TEMPLATE_VIEWS)[number];

/** Where a placed component sits: its tab, and its place in that tab. */
export interface ComponentPosition {
  tab: number;
  index: number;
}

/** What a new template starts as: one empty tab, waiting for components to be dropped on it. */
export const EMPTY_TEMPLATE: readonly TemplateTab[] = [{ name: 'Tab 1', components: [] }];

/** A component as it is first placed. The stoichiometry table starts with every block on. */
function newComponent(type: TemplateComponentType): TemplateComponent {
  return type === 'stoichiometryTable'
    ? { type, reactionScheme: true, reactantsReagentsSolvents: true, intendedProducts: true }
    : { type };
}

/**
 * The components a tab can still take, in palette order. A tab holds each at most once — the
 * backend refuses duplicates within a tab (`TemplateValidationUtil`) — but two tabs may share one.
 */
export function availableComponents(tab: TemplateTab): TemplateComponentType[] {
  const used = new Set(tab.components.map((component) => component.type));
  return TEMPLATE_COMPONENT_TYPES.filter((type) => !used.has(type));
}

function withTab(
  tabs: readonly TemplateTab[],
  index: number,
  change: (tab: TemplateTab) => TemplateTab,
): TemplateTab[] {
  return tabs.map((tab, i) => (i === index ? change(tab) : tab));
}

function inserted<T>(items: readonly T[], at: number, item: T): T[] {
  const next = [...items];
  next.splice(Math.max(0, Math.min(at, next.length)), 0, item);
  return next;
}

/** A tab named after the first free `Tab N`, so a fresh one never repeats a name already there. */
export function addTab(tabs: readonly TemplateTab[]): TemplateTab[] {
  const names = new Set(tabs.map((tab) => tab.name));
  let n = tabs.length + 1;
  while (names.has(`Tab ${n}`)) n += 1;
  return [...tabs, { name: `Tab ${n}`, components: [] }];
}

export function removeTab(tabs: readonly TemplateTab[], index: number): TemplateTab[] {
  return tabs.filter((_, i) => i !== index);
}

export function renameTab(tabs: readonly TemplateTab[], index: number, name: string): TemplateTab[] {
  return withTab(tabs, index, (tab) => ({ ...tab, name }));
}

/**
 * Places a component from the palette at `at` in a tab, or at its end. A component the tab
 * already holds is left where it is: the palette never offers it, but a stale drag might.
 */
export function addComponent(
  tabs: readonly TemplateTab[],
  tabIndex: number,
  type: TemplateComponentType,
  at?: number,
): TemplateTab[] {
  const tab = tabs[tabIndex];
  if (!tab || tab.components.some((component) => component.type === type)) return [...tabs];
  return withTab(tabs, tabIndex, () => ({
    ...tab,
    components: inserted(tab.components, at ?? tab.components.length, newComponent(type)),
  }));
}

export function removeComponent(tabs: readonly TemplateTab[], { tab, index }: ComponentPosition): TemplateTab[] {
  return withTab(tabs, tab, (current) => ({
    ...current,
    components: current.components.filter((_, i) => i !== index),
  }));
}

/**
 * Moves a placed component — up or down its own tab, or into another. `to.index` is a slot in the
 * target as it is before the move, the place a drop indicator points at. A move into a tab that
 * already holds the same component is refused, as the backend would refuse the template.
 */
export function moveComponent(
  tabs: readonly TemplateTab[],
  from: ComponentPosition,
  to: ComponentPosition,
): TemplateTab[] {
  const component = tabs[from.tab]?.components[from.index];
  const target = tabs[to.tab];
  if (!component || !target) return [...tabs];

  if (from.tab === to.tab) {
    // Taking the component out first shifts every slot after it up by one.
    const slot = to.index > from.index ? to.index - 1 : to.index;
    if (slot === from.index) return [...tabs];
    const rest = target.components.filter((_, i) => i !== from.index);
    return withTab(tabs, to.tab, (tab) => ({ ...tab, components: inserted(rest, slot, component) }));
  }

  if (target.components.some((placed) => placed.type === component.type)) return [...tabs];
  const removed = removeComponent(tabs, from);
  return withTab(removed, to.tab, (tab) => ({ ...tab, components: inserted(tab.components, to.index, component) }));
}

/** Switches one block of a placed stoichiometry table on or off. */
export function setStoichiometryPart(
  tabs: readonly TemplateTab[],
  { tab, index }: ComponentPosition,
  part: StoichiometryPart,
  on: boolean,
): TemplateTab[] {
  return withTab(tabs, tab, (current) => ({
    ...current,
    components: current.components.map((component, i) =>
      i === index && component.type === 'stoichiometryTable' ? { ...component, [part]: on } : component,
    ),
  }));
}

/** Why a tab cannot be saved, or undefined — the first problem only, said beside the tab. */
export function tabError(tab: TemplateTab): string | undefined {
  if (tab.name.trim() === '') return 'Tab Name is required';
  if (tab.components.length === 0) return 'Add at least one component';
  const stoichiometry = tab.components.find((component) => component.type === 'stoichiometryTable');
  if (
    stoichiometry &&
    !stoichiometry.reactionScheme &&
    !stoichiometry.reactantsReagentsSolvents &&
    !stoichiometry.intendedProducts
  ) {
    return 'Pick at least one part of the Stoichiometric Calculation';
  }
  return undefined;
}

/** The `POST /templates` body, names trimmed. */
export function toTemplateRequest(name: string, tabs: readonly TemplateTab[]): TemplateRequest {
  return {
    name: name.trim(),
    templateTabs: tabs.map((tab) => ({ name: tab.name.trim(), components: tab.components })),
  };
}
