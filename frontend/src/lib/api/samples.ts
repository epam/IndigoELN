import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, Query } from '@tanstack/react-query';
import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import { getNextPageParam } from '@/lib/api/collections';
import { sampleRowKey } from '@/lib/search';

import type { Page, UUID } from '@/lib/types/common.ts';
import type { FindSamplesRequest, SampleDTO } from '@/lib/types/samples.ts';

/**
 * Large because PubChem cannot page: it answers page 0 and nothing after, so its one page has to
 * hold everything worth showing. The other catalogs page normally at the same size.
 */
const SEARCH_PAGE_SIZE = 100;

const sampleKeys = {
  all: () => ['sampleSearch'] as const,
  /**
   * The whole request is the key — TanStack Query hashes it structurally. That is what makes the
   * catalog radio work with no imperative refetch: `catalog` is part of the request, so choosing
   * a different catalog moves the key, starts a new query, and leaves the previous catalog's
   * results in cache to come back instantly if the choice is undone.
   */
  search: (request: FindSamplesRequest) => [...sampleKeys.all(), request] as const,
};

/** Reads the catalog back out of a `sampleKeys.search` key, so the key's layout stays in one place. */
function isMyMaterialsSearch(query: Query): boolean {
  const [, request] = query.queryKey as ReturnType<typeof sampleKeys.search>;
  return request.catalog === 'MY_MATERIALS';
}

function searchSamples(request: FindSamplesRequest, pageNo: number, signal?: AbortSignal): Promise<Page<SampleDTO>> {
  return apiFetch<Page<SampleDTO>>(`/api/eln/samples/search?pageNo=${pageNo}&pageSize=${SEARCH_PAGE_SIZE}`, {
    method: 'POST',
    json: request,
    signal,
  });
}

/**
 * A catalog search, paged like every other list.
 *
 * It has no disabled state: a search is only ever mounted for a structure that needs one, so
 * there is nothing to wait for and nothing to debounce — the structure is the whole query.
 * `signal` is consumed so switching catalogs aborts the request for the catalog no longer
 * selected, rather than letting it run to completion into a cache entry nothing will read.
 */
export function useSampleSearch(request: FindSamplesRequest) {
  return useInfiniteQuery({
    queryKey: sampleKeys.search(request),
    queryFn: ({ pageParam, signal }) => searchSamples(request, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam,
  });
}

/**
 * Drops a search's cached answer, for a Search pressed on a request that has not changed. Moving
 * the key is what refetches everywhere else, and an unchanged key moves nothing — so without this
 * a My Materials search re-run after an unmark keeps answering from the patched cache, still
 * listing the material that was just removed (#802).
 *
 * A reset rather than an invalidation: the table goes back to its skeletons instead of leaving the
 * old answer up, unannounced, until the new one lands, and only page 0 is asked for again rather
 * than every page scrolled through.
 */
export function useResetSampleSearch() {
  const queryClient = useQueryClient();

  return useCallback(
    (request: FindSamplesRequest) => queryClient.resetQueries({ queryKey: sampleKeys.search(request), exact: true }),
    [queryClient],
  );
}

/**
 * Adds a sample to, or removes it from, the signed-in user's My Materials list. The whole
 * `SampleDTO` is the body: the backend keys the mark on `source` + `sampleKey` and imports the
 * compound from `catalog`.
 *
 * The response is the updated `SampleDTO`, and its `marked` is written over the matching row in
 * **every** cached search rather than invalidating anything — the port of
 * `InfiniteSearchLoader.replace`. Two reasons it has to be a patch: a refetch would re-run a
 * substructure search (and possibly a PubChem call) to learn one boolean, and the My Materials
 * catalog *filters* on the flag, so refetching there would make the row the user just unmarked
 * vanish from under the pointer.
 *
 * Only the flag is copied, not the row: the same sample shows in its own catalog's tab and in My
 * Materials, and each tab keeps the record its own catalog answered with.
 *
 * The patch only covers rows already listed, though, and My Materials *is* the flag: a mark adds a
 * row its cached searches lack, an unmark leaves one they should not have. So those searches are
 * dropped, and the ones on screen — which keep the row under the pointer until Search is pressed
 * again (`useResetSampleSearch`) — are marked stale, so they are asked again once left and come
 * back to. Without that, Analyze RXN's catalog radio, switched away and back within `staleTime`,
 * brought the old list back (#802).
 */
export function useMarkSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sample, marked }: { sample: SampleDTO; marked: boolean }) =>
      apiFetch<SampleDTO>(`/api/eln/samples/${marked ? 'mark' : 'unmark'}`, { method: 'POST', json: sample }),
    onSuccess: (updated) => {
      const key = sampleRowKey(updated);
      queryClient.setQueriesData<InfiniteData<Page<SampleDTO>>>({ queryKey: sampleKeys.all() }, (data) => {
        if (data == null) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (sampleRowKey(item) === key ? { ...item, marked: updated.marked } : item)),
          })),
        };
      });
      queryClient.removeQueries({
        queryKey: sampleKeys.all(),
        predicate: (query) => isMyMaterialsSearch(query) && query.getObserversCount() === 0,
      });
      void queryClient.invalidateQueries({
        queryKey: sampleKeys.all(),
        predicate: isMyMaterialsSearch,
        refetchType: 'none',
      });
    },
  });
}

/** Where an ELN compound's molfile is served from, for `StructureImage` to fetch and render. */
export function compoundMolfilePath(compoundID: UUID): string {
  return `/api/eln/compounds/${compoundID}/molfile`;
}

/** How to draw a catalog hit's structure: fetch its molfile from an API path, or use the InChI it carries. */
export type SamplePicture = { path: string } | { structure: string };

/**
 * Where a catalog hit's structure comes from, in order — or null when there is nowhere. Either
 * way Ketcher renders it in the browser:
 *
 * - A My Materials hit's `compoundID` names an ELN compound, which has a molfile endpoint of its own.
 * - A PubChem hit carries its InChI.
 * - Any other hit with a `compoundID` has its id in `source`, which its catalog serves the
 *   molfile by — an SRS hit's `compoundID` is an SRS id, meaningless to the ELN directly.
 *
 * Both paths are `@Cached(30, DAYS)` and neither takes a revision, so the path fully identifies
 * the molfile — which is what lets `StructureImage` cache on it forever.
 */
export function samplePicture(sample: SampleDTO): SamplePicture | null {
  if (sample.catalog === 'MY_MATERIALS' && sample.compoundID != null) {
    return { path: compoundMolfilePath(sample.compoundID) };
  }
  if (sample.inchi != null) return { structure: sample.inchi };
  if (sample.compoundID != null) {
    return { path: `/api/eln/compounds/by-catalog/${sample.catalog}/${sample.source}/${sample.compoundID}/molfile` };
  }
  return null;
}
