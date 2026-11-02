import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { useSettledSearch } from '@/lib/api/collections';
import type { CollectionFilters, Page, UUID } from '@/lib/types/common.ts';
import type { Template, TemplateDetails, TemplateEditRequest, TemplateRequest } from '@/lib/types/templates.ts';

/**
 * Exported although no component reads it: `src/lib/query-client.ts` hashes `list()` and matches
 * `detail()`'s root to decide what gets persisted to localStorage. Not a candidate for going
 * private.
 */
export const templateKeys = {
  list: () => ['templates'] as const,
  // Under the list's root, so every write that invalidates the list refreshes these too — but a
  // key of its own, so only the unfiltered list above is persisted.
  filtered: (filters: CollectionFilters) => ['templates', filters] as const,
  detail: (id: UUID) => ['templateDetails', id] as const,
};

/**
 * One page big enough to be the whole list. `/templates` is `@BeanParam Paging`, whose
 * `DEFAULT_PAGE_SIZE` is 10 — so a request that does not say silently offers only the ten most
 * recently modified templates.
 */
const TEMPLATE_PAGE_SIZE = 100;

function fetchTemplates(signal?: AbortSignal): Promise<Page<Template>> {
  return apiFetch<Page<Template>>(`/api/eln/templates?pageSize=${TEMPLATE_PAGE_SIZE}`, { signal });
}

/**
 * Every template — for the Add Experiment picker, which enables it only while that dialog is open
 * so a notebook page nobody creates from never asks, and for the Templates screen, which always
 * does.
 *
 * Two deliberate differences from `useNextNotebookNumber`, the other query a dialog's initializing
 * phase waits on:
 *
 * - **No `staleTime: 0`.** A notebook number is consumed by the create that follows it, so a
 *   cached one is wrong by the time it is reused; a template list is not, and the client's 30 s
 *   default is right.
 * - Its caller gates `initializing` on **`isPending` alone**, not `isPending || isFetching`. A
 *   background refetch of a list already on screen must not re-freeze a dialog someone is filling
 *   in — the opposite of the notebook case, where showing the stale value was the whole problem.
 *
 * The list arrives in the server's order, which is by `modifiedAt`: `SortOrder` is `EARLIEST` /
 * `LATEST` and offers nothing alphabetical, so there is no better order to ask for.
 */
export function useTemplates(enabled: boolean) {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: ({ signal }) => fetchTemplates(signal),
    enabled,
    // Persisted to localStorage, and only observed while the dialog above is open — see the
    // note on `useTemplate` for why the default gcTime would take it off disk again.
    gcTime: Infinity,
  });
}

function fetchFilteredTemplates(filters: CollectionFilters, signal?: AbortSignal): Promise<Page<Template>> {
  const params = new URLSearchParams({ sort: filters.sort, pageSize: String(TEMPLATE_PAGE_SIZE) });
  if (filters.search) params.set('search', filters.search);
  if (filters.createdByMe) params.set('createdByMe', 'true');
  return apiFetch<Page<Template>>(`/api/eln/templates?${params}`, { signal });
}

/**
 * The Templates screen's list, as its action bar filters it — searched, sorted and narrowed to
 * the user's own on the server, in one page as big as `useTemplates`' for the same reason. The
 * search is debounced the way every list's is (`useProjects`): the key follows the term as typed,
 * and `enabled` waits for it to settle.
 */
export function useFilteredTemplates(filters: CollectionFilters) {
  const settled = useSettledSearch(filters.search);
  return useQuery({
    queryKey: templateKeys.filtered(filters),
    queryFn: ({ signal }) => fetchFilteredTemplates(filters, signal),
    enabled: settled,
  });
}

function fetchTemplate(id: UUID, signal?: AbortSignal): Promise<TemplateDetails> {
  return apiFetch<TemplateDetails>(`/api/eln/templates/${id}`, { signal });
}

/**
 * The template an experiment is laid out by — and the one the template page shows. The id only exists once the experiment itself has
 * loaded, so this is the second of two chained queries and stays disabled until then — passing
 * `undefined` is the normal first render, not an error.
 */
export function useTemplate(id: UUID | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchTemplate(id!, signal), // enabled below guarantees it is set
    enabled: id !== undefined,
    // Persisted to localStorage, and observed only while its experiment is open. Under the
    // default gcTime the entry would be collected five minutes after the user navigates away,
    // and the save that follows would dehydrate a cache no longer holding it — taking it off
    // disk too. Every persisted query needs this.
    gcTime: Infinity,
  });
}

function createTemplate(request: TemplateRequest): Promise<TemplateDetails> {
  return apiFetch<TemplateDetails>('/api/eln/templates', { method: 'POST', json: request });
}

/**
 * Creates a template. The answer is the whole detail, so it goes straight into the cache the
 * Templates sheet and every experiment built on it read; the list is refetched for the new row.
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: (template) => {
      queryClient.setQueryData(templateKeys.detail(template.id), template);
      void queryClient.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

function renameTemplate(id: UUID, request: TemplateEditRequest): Promise<TemplateDetails> {
  return apiFetch<TemplateDetails>(`/api/eln/templates/${id}`, { method: 'PATCH', json: request });
}

/**
 * Renames a template — the one thing `PATCH /templates/{id}` changes. Experiments refer to their
 * template by id, so nothing built on it notices.
 */
export function useRenameTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: UUID; name: string }) => renameTemplate(id, { name }),
    onSuccess: (template) => {
      queryClient.setQueryData(templateKeys.detail(template.id), template);
      void queryClient.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

function deleteTemplate(id: UUID): Promise<void> {
  return apiFetch<void>(`/api/eln/templates/${id}`, { method: 'DELETE' });
}

/**
 * Deletes a template. The backend refuses one an experiment was created from — the experiment
 * keeps a foreign key to it — and that refusal is toasted like any failed mutation.
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: templateKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}
