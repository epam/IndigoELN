import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeSamplePage, SAMPLE_RESULTS } from '@/mocks/fixtures';

import type { Page } from '@/lib/types/common.ts';
import type { FindSamplesRequest, SampleDTO } from '@/lib/types/samples.ts';

vi.mock('@/lib/auth', () => ({
  auth: { getAccessToken: async () => 'token', requireLogin: async () => false, signOut: vi.fn() },
}));

const apiFetch = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: (path: string, init?: { json?: unknown }) => apiFetch(path, init) };
});

const { useMarkSample, useSampleSearch } = await import('@/lib/api/samples');

const MARKED = { ...SAMPLE_RESULTS[0], marked: true };

function pageOf(items: SampleDTO[]): InfiniteData<Page<SampleDTO>> {
  return { pages: [makeSamplePage(items)], pageParams: [0] };
}

/** `sampleKeys` is private; this is its shape, `['sampleSearch', request]`. */
function keyOf(request: FindSamplesRequest) {
  return ['sampleSearch', request];
}

describe('useMarkSample', () => {
  /**
   * #802. A My Materials search off screen is dropped, so coming back to it asks again; the one on
   * screen keeps the row under the pointer, flag patched, but goes stale, so leaving it and coming
   * back asks again too (Analyze RXN's catalog radio); other catalogs are only patched.
   */
  it('drops My Materials searches off screen and marks the one on screen stale', async () => {
    const shown: FindSamplesRequest = { catalog: 'MY_MATERIALS', quickSearch: 'acid' };
    const hidden: FindSamplesRequest = { catalog: 'MY_MATERIALS', quickSearch: 'aspirin' };
    const other: FindSamplesRequest = { catalog: 'SRS', quickSearch: 'aspirin' };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(keyOf(hidden), pageOf([MARKED]));
    client.setQueryData(keyOf(other), pageOf([MARKED]));
    apiFetch.mockImplementation((path: string, init?: { json?: SampleDTO }) =>
      Promise.resolve(path.endsWith('/unmark') ? { ...init?.json, marked: false } : makeSamplePage([MARKED])),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => ({ search: useSampleSearch(shown), mark: useMarkSample() }), { wrapper });
    await waitFor(() => expect(result.current.search.isSuccess).toBe(true));

    await act(() => result.current.mark.mutateAsync({ sample: MARKED, marked: false }));

    expect(client.getQueryData(keyOf(hidden))).toBeUndefined();
    expect(client.getQueryData<InfiniteData<Page<SampleDTO>>>(keyOf(shown))?.pages[0].items[0].marked).toBe(false);
    expect(client.getQueryState(keyOf(shown))?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyOf(other))?.isInvalidated).toBe(false);
    expect(client.getQueryData<InfiniteData<Page<SampleDTO>>>(keyOf(other))?.pages[0].items[0].marked).toBe(false);
  });
});
