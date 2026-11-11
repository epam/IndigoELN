import { describe, expect, it } from 'vitest';

import {
  addComponent,
  addTab,
  availableComponents,
  moveComponent,
  removeComponent,
  removeTab,
  renameTab,
  setStoichiometryPart,
  tabError,
  templateNameError,
  toTemplateRequest,
} from '@/components/templates/template-form';

import type { TemplateTab } from '@/lib/types/templates.ts';

const TABS: TemplateTab[] = [
  { name: 'Reaction', components: [{ type: 'experimentDetails' }, { type: 'attachments' }, { type: 'batches' }] },
  { name: 'Summary', components: [{ type: 'versionHistory' }] },
];

const types = (tab: TemplateTab) => tab.components.map((component) => component.type);

describe('templateNameError', () => {
  it('requires a name, and refuses one already taken', () => {
    expect(templateNameError('  ', [])).toBe('Template Name is required');
    expect(templateNameError(' Default ', ['Default'])).toBe("Template 'Default' already exists");
    expect(templateNameError('Synthesis', ['Default'])).toBeUndefined();
  });

  /** Renaming leaves a template its own name — taken, but by itself. */
  it('lets a template keep its own name', () => {
    expect(templateNameError('Default', ['Default'], 'Default')).toBeUndefined();
  });
});

describe('tabs', () => {
  it('names a new tab after the first free number', () => {
    expect(addTab([{ name: 'Tab 2', components: [] }]).at(-1)?.name).toBe('Tab 3');
    expect(
      addTab([
        { name: 'Tab 1', components: [] },
        { name: 'Tab 3', components: [] },
      ]).at(-1)?.name,
    ).toBe('Tab 4');
  });

  it('renames and removes a tab by position', () => {
    expect(renameTab(TABS, 1, 'History')[1].name).toBe('History');
    expect(removeTab(TABS, 0).map((tab) => tab.name)).toEqual(['Summary']);
  });
});

describe('placing components', () => {
  /** A tab holds each component once — the backend's own rule — but two tabs may share one. */
  it('offers only what the tab does not hold yet', () => {
    expect(availableComponents(TABS[1])).toEqual([
      'experimentDetails',
      'experimentDescription',
      'stoichiometryTable',
      'batches',
      'attachments',
    ]);
    expect(addComponent(TABS, 0, 'attachments')).toEqual(TABS);
  });

  it('adds at the end, or where it was dropped', () => {
    expect(types(addComponent(TABS, 1, 'batches')[1])).toEqual(['versionHistory', 'batches']);
    expect(types(addComponent(TABS, 0, 'experimentDescription', 1)[0])).toEqual([
      'experimentDetails',
      'experimentDescription',
      'attachments',
      'batches',
    ]);
  });

  it('starts a stoichiometry table with every block on, and switches them one by one', () => {
    const placed = addComponent(TABS, 1, 'stoichiometryTable', 0);
    expect(placed[1].components[0]).toEqual({
      type: 'stoichiometryTable',
      reactionScheme: true,
      reactantsReagentsSolvents: true,
      intendedProducts: true,
    });
    const off = setStoichiometryPart(placed, { tab: 1, index: 0 }, 'intendedProducts', false);
    expect(off[1].components[0]).toMatchObject({ intendedProducts: false, reactionScheme: true });
  });

  it('removes a component', () => {
    expect(types(removeComponent(TABS, { tab: 0, index: 1 })[0])).toEqual(['experimentDetails', 'batches']);
  });
});

describe('moveComponent', () => {
  /** `to.index` is the slot as the tab stands before the move — where a drop line is drawn. */
  it('reorders within a tab', () => {
    expect(types(moveComponent(TABS, { tab: 0, index: 0 }, { tab: 0, index: 3 })[0])).toEqual([
      'attachments',
      'batches',
      'experimentDetails',
    ]);
    expect(types(moveComponent(TABS, { tab: 0, index: 2 }, { tab: 0, index: 0 })[0])).toEqual([
      'batches',
      'experimentDetails',
      'attachments',
    ]);
    // Dropped on either side of itself: nowhere to go.
    expect(moveComponent(TABS, { tab: 0, index: 1 }, { tab: 0, index: 2 })).toEqual(TABS);
  });

  it('moves into another tab', () => {
    const moved = moveComponent(TABS, { tab: 0, index: 1 }, { tab: 1, index: 0 });
    expect(types(moved[0])).toEqual(['experimentDetails', 'batches']);
    expect(types(moved[1])).toEqual(['attachments', 'versionHistory']);
  });

  it('refuses a move into a tab that already holds the component', () => {
    const tabs = addComponent(TABS, 1, 'batches');
    expect(moveComponent(tabs, { tab: 0, index: 2 }, { tab: 1, index: 0 })).toEqual(tabs);
  });
});

describe('tabError', () => {
  it('says why a tab cannot be saved', () => {
    expect(tabError({ name: ' ', components: [{ type: 'batches' }] })).toBe('Tab Name is required');
    expect(tabError({ name: 'Tab 1', components: [] })).toBe('Add at least one component');
    expect(
      tabError({
        name: 'Tab 1',
        components: [
          {
            type: 'stoichiometryTable',
            reactionScheme: false,
            reactantsReagentsSolvents: false,
            intendedProducts: false,
          },
        ],
      }),
    ).toBe('Pick at least one part of the Stoichiometric Calculation');
    expect(tabError(TABS[0])).toBeUndefined();
  });
});

it('builds the POST body with names trimmed', () => {
  expect(toTemplateRequest(' Synthesis ', [{ name: ' Reaction ', components: [{ type: 'batches' }] }])).toEqual({
    name: 'Synthesis',
    templateTabs: [{ name: 'Reaction', components: [{ type: 'batches' }] }],
  });
});
