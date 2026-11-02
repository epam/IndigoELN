import { Check, GripVertical, Minus, MousePointerClick, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';

import {
  addComponent,
  addTab,
  availableComponents,
  type ComponentPosition,
  moveComponent,
  removeComponent,
  removeTab,
  renameTab,
  setStoichiometryPart,
  tabError,
} from '@/components/templates/template-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { TemplateComponent, TemplateComponentType, TemplateTab } from '@/lib/types/templates.ts';
import {
  COMPONENT_DESCRIPTIONS,
  COMPONENT_LABELS,
  STOICHIOMETRY_PART_LABELS,
  STOICHIOMETRY_PARTS,
} from '@/lib/types/templates.ts';

/** What is being dragged: a component off the palette, or one already placed in a tab. */
type Drag = { source: 'palette'; type: TemplateComponentType } | { source: 'tab'; from: ComponentPosition };

const CARD_CLASS = 'flex flex-col gap-4 rounded-6 bg-card p-4 shadow-card';
const CARD_TITLE_CLASS = 'text-[16px]/6 font-semibold text-neutral-1000';

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className={CARD_CLASS}>
      <div className="flex h-8 items-center justify-between gap-4">
        <h2 className={CARD_TITLE_CLASS}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A component's name over its one-line description — how both the palette and a tab show one. */
function ComponentText({ type }: { type: TemplateComponentType }) {
  return (
    <span className="flex min-w-0 flex-col text-left">
      <span className="text-[14px]/6 font-semibold text-neutral-1000">{COMPONENT_LABELS[type]}</span>
      <span className="text-[12px]/5 text-neutral-800">{COMPONENT_DESCRIPTIONS[type]}</span>
    </span>
  );
}

/** The slot a drag over a placed component points at: before it in its upper half, after in its lower. */
function slotAt(event: DragEvent, position: ComponentPosition): ComponentPosition {
  const box = event.currentTarget.getBoundingClientRect();
  return { tab: position.tab, index: position.index + (event.clientY > box.top + box.height / 2 ? 1 : 0) };
}

/** Where a drop would land, drawn between two components. */
function DropLine() {
  return <div aria-hidden className="h-0.5 rounded-full bg-blue-400" />;
}

/**
 * The template constructor: the components palette, and the tabs they are placed in.
 *
 * **Editable only while `onChange` is passed** — a template that is not saved yet. A saved one is
 * shown with the same layout but nothing to change, since `PATCH /templates/{id}` takes the name
 * alone; the palette is left out, as there is nowhere to put anything.
 *
 * Components go into the **selected** tab — the one underlined, chosen by clicking into it — by
 * clicking them in the palette, or into any tab by dragging, as the design has it. Placed ones are
 * dragged to reorder or to move between tabs, or moved with the arrow keys on their grip. A tab
 * holds each component once (`availableComponents`), so the palette shows only what the selected
 * tab can still take.
 *
 * `showErrors` is the page's, set once Save has been tried: until then a fresh empty tab is
 * simply unfinished, not wrong.
 */
export function TemplateConstructor({
  tabs,
  onChange,
  showErrors = false,
}: {
  tabs: readonly TemplateTab[];
  onChange?: (tabs: TemplateTab[]) => void;
  showErrors?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [editingTab, setEditingTab] = useState<number | null>(null);
  // What is being dragged, twice over: the ref is what the drag handlers read — set in `dragstart`,
  // it is there for the very next `dragover`, which a render may not have followed yet — and the
  // state is what fades the dragged component.
  const dragging = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropSlot, setDropSlot] = useState<ComponentPosition | null>(null);

  const editable = onChange !== undefined;
  const activeTab = Math.min(selected, tabs.length - 1);
  const change = (next: TemplateTab[]) => onChange?.(next);

  const draggedType = (current: Drag): TemplateComponentType | undefined =>
    current.source === 'palette' ? current.type : tabs[current.from.tab]?.components[current.from.index]?.type;

  /** Whether the dragged component may land in a tab — anywhere in its own, or in one without it. */
  function accepts(tab: number): boolean {
    const current = dragging.current;
    if (!current) return false;
    if (current.source === 'tab' && current.from.tab === tab) return true;
    const type = draggedType(current);
    return type !== undefined && !tabs[tab]?.components.some((component) => component.type === type);
  }

  function endDrag() {
    dragging.current = null;
    setDrag(null);
    setDropSlot(null);
  }

  function hover(event: DragEvent, slot: ComponentPosition) {
    if (!accepts(slot.tab)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = dragging.current?.source === 'palette' ? 'copy' : 'move';
    if (dropSlot?.tab !== slot.tab || dropSlot.index !== slot.index) setDropSlot(slot);
  }

  /**
   * Where the drop lands is worked out again from the drop itself rather than read back from
   * `dropSlot`: a quick drop can follow its only `dragover` before that state has rendered.
   */
  function drop(event: DragEvent, slot: ComponentPosition) {
    event.preventDefault();
    event.stopPropagation();
    const current = dragging.current;
    if (current && accepts(slot.tab)) {
      change(
        current.source === 'palette'
          ? addComponent(tabs, slot.tab, current.type, slot.index)
          : moveComponent(tabs, current.from, slot),
      );
      setSelected(slot.tab);
    }
    endDrag();
  }

  function startDrag(event: DragEvent, next: Drag, label: string) {
    // Firefox starts no drag without data; the label is also what a drop outside would carry.
    event.dataTransfer.setData('text/plain', label);
    event.dataTransfer.effectAllowed = next.source === 'palette' ? 'copy' : 'move';
    dragging.current = next;
    setDrag(next);
  }

  const palette = editable && tabs[activeTab] && (
    <Panel title="Components">
      <div className="flex flex-col gap-2">
        {availableComponents(tabs[activeTab]).map((type) => (
          <button
            key={type}
            type="button"
            draggable
            aria-label={`Add ${COMPONENT_LABELS[type]} to ${tabs[activeTab].name}`}
            onClick={() => change(addComponent(tabs, activeTab, type))}
            onDragStart={(event) => startDrag(event, { source: 'palette', type }, COMPONENT_LABELS[type])}
            onDragEnd={endDrag}
            className="flex cursor-grab items-start gap-2 rounded-md border border-neutral-300 bg-background p-3 outline-none hover:border-blue-400 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="mt-1 size-4 shrink-0 text-blue-400" />
            <ComponentText type={type} />
          </button>
        ))}
        {availableComponents(tabs[activeTab]).length === 0 && (
          <p className="text-[14px]/6 text-neutral-700">Every component is in {tabs[activeTab].name} already.</p>
        )}
      </div>
    </Panel>
  );

  function placedComponent(component: TemplateComponent, position: ComponentPosition, tab: TemplateTab) {
    const label = COMPONENT_LABELS[component.type];
    const count = tab.components.length;
    return (
      <div
        draggable={editable}
        onDragStart={(event) => startDrag(event, { source: 'tab', from: position }, label)}
        onDragEnd={endDrag}
        // A drop zone has to cancel `dragenter` as well as `dragover`, or the browser may not offer it the drop.
        onDragEnter={(event) => hover(event, slotAt(event, position))}
        onDragOver={(event) => hover(event, slotAt(event, position))}
        onDrop={(event) => drop(event, slotAt(event, position))}
        className={cn(
          'flex flex-col gap-2 rounded-md border border-neutral-300 bg-background p-3',
          drag?.source === 'tab' &&
            drag.from.tab === position.tab &&
            drag.from.index === position.index &&
            'opacity-50',
        )}
      >
        <div className="flex items-start gap-2">
          {editable && (
            <button
              type="button"
              aria-label={`Move ${label}`}
              aria-keyshortcuts="ArrowUp ArrowDown"
              title="Drag, or use the arrow keys, to move"
              onKeyDown={(event) => {
                const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 2 : 0;
                const index = position.index + step;
                if (step === 0 || index < 0 || index > count) return;
                event.preventDefault();
                change(moveComponent(tabs, position, { tab: position.tab, index }));
              }}
              className="mt-1 cursor-grab rounded-2 text-blue-400 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <GripVertical className="size-4" />
            </button>
          )}
          <span className="min-w-0 flex-1">
            <ComponentText type={component.type} />
          </span>
          {editable && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${label} from ${tab.name}`}
              onClick={() => change(removeComponent(tabs, position))}
              className="text-neutral-700"
            >
              <X />
            </Button>
          )}
        </div>
        {component.type === 'stoichiometryTable' && (
          <div role="group" aria-label={`${label} parts`} className="ml-6 flex flex-col gap-1">
            {STOICHIOMETRY_PARTS.map((part) =>
              editable ? (
                <label
                  key={part}
                  className="flex w-fit cursor-pointer items-center gap-2 text-[14px]/6 text-neutral-800"
                >
                  <Checkbox
                    checked={component[part]}
                    onCheckedChange={(checked) => change(setStoichiometryPart(tabs, position, part, checked))}
                  />
                  {STOICHIOMETRY_PART_LABELS[part]}
                </label>
              ) : (
                // Read-only, a disabled checkbox would be too faint to tell on from off.
                <span
                  key={part}
                  className={cn(
                    'flex items-center gap-2 text-[14px]/6',
                    component[part] ? 'text-neutral-1000' : 'text-neutral-700 line-through',
                  )}
                >
                  {component[part] ? (
                    <Check aria-hidden className="size-4 text-blue-400" />
                  ) : (
                    <Minus aria-hidden className="size-4" />
                  )}
                  {STOICHIOMETRY_PART_LABELS[part]}
                  <span className="sr-only">{component[part] ? '(included)' : '(not included)'}</span>
                </span>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  function tabSection(tab: TemplateTab, tabIndex: number) {
    const active = editable && tabIndex === activeTab;
    const error = showErrors ? tabError(tab) : undefined;
    const slot = dropSlot?.tab === tabIndex ? dropSlot.index : undefined;
    return (
      // By position: two tabs may share a name.
      <section
        key={tabIndex}
        aria-label={tab.name}
        // Clicking or tabbing into a tab selects it, so the palette fills the tab being worked on.
        onClickCapture={() => setSelected(tabIndex)}
        onFocusCapture={() => setSelected(tabIndex)}
        onDragEnter={(event) => hover(event, { tab: tabIndex, index: tab.components.length })}
        onDragOver={(event) => hover(event, { tab: tabIndex, index: tab.components.length })}
        onDrop={(event) => drop(event, { tab: tabIndex, index: tab.components.length })}
        className="flex flex-col gap-2"
      >
        <header
          className={cn(
            'flex h-9 items-center gap-1 border-b-2 px-2',
            active ? 'border-blue-400 text-blue-400' : 'border-neutral-300 text-neutral-1000',
          )}
        >
          {editingTab === tabIndex ? (
            <Input
              // The box replaces the name the user just asked to change.
              autoFocus
              aria-label={`${tab.name} name`}
              defaultValue={tab.name}
              onFocus={(event) => event.target.select()}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name) change(renameTab(tabs, tabIndex, name));
                setEditingTab(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setEditingTab(null);
              }}
              className="h-7 flex-1"
            />
          ) : (
            <h3 className="flex-1 truncate text-[14px]/6 font-semibold">{tab.name}</h3>
          )}
          {editable && editingTab !== tabIndex && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Rename ${tab.name}`}
              onClick={() => setEditingTab(tabIndex)}
              className="text-blue-400"
            >
              <Pencil />
            </Button>
          )}
          {editable && tabs.length > 1 && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${tab.name}`}
              onClick={() => change(removeTab(tabs, tabIndex))}
              className="text-blue-400"
            >
              <Trash2 />
            </Button>
          )}
        </header>

        {tab.components.length === 0 ? (
          <div
            className={cn(
              'flex min-h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center text-[14px]/6',
              slot !== undefined ? 'border-blue-400 bg-blue-10 text-blue-400' : 'border-neutral-300 text-neutral-700',
            )}
          >
            <MousePointerClick aria-hidden className="size-5" />
            {editable ? 'Drag and drop components here, or pick them from the list' : 'No components'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tab.components.map((component, index) => (
              // By type: a tab holds each once, and a key that follows the component keeps the
              // grip focused as the arrow keys move it.
              <div key={component.type} className="flex flex-col gap-2">
                {slot === index && <DropLine />}
                {placedComponent(component, { tab: tabIndex, index }, tab)}
              </div>
            ))}
            {slot === tab.components.length && <DropLine />}
          </div>
        )}

        {error && (
          <p role="alert" className="text-[12px]/5 text-destructive">
            {error}
          </p>
        )}
      </section>
    );
  }

  const template = (
    <Panel
      title="Template"
      action={
        editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              change(addTab(tabs));
              // A tab is added to be filled, so the palette turns to it.
              setSelected(tabs.length);
            }}
          >
            <Plus />
            Add Tab
          </Button>
        )
      }
    >
      {!editable && (
        <p className="text-[14px]/6 text-neutral-800">
          A saved template keeps its tabs and components: experiments are laid out by them.
        </p>
      )}
      <div className="flex flex-col gap-6">{tabs.map(tabSection)}</div>
    </Panel>
  );

  return editable ? (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
      {palette}
      {template}
    </div>
  ) : (
    template
  );
}
