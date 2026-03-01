import { describe, it, expect } from 'vitest';
import type { HierarchyNode } from '@shared/hierarchy-types';
import {
  findDOK1Nodes,
  findDOK2Nodes,
  findDOK3Nodes,
  findDOK4Nodes,
  buildParentMap,
  findAncestorContext,
  extractFactsFromHierarchy,
  extractDOK2Summaries,
  extractDOK3Insights,
  extractDOK4SPOVs,
  extractAllFromHierarchy,
  extractPurposeFromHierarchy,
  convertToExtractorFormat,
} from './hierarchyExtractor';

/** Factory for HierarchyNode with sensible defaults */
function makeNode(overrides: Partial<HierarchyNode> & { id: string; name: string }): HierarchyNode {
  return {
    depth: 0,
    note: null,
    children: [],
    isDOK1Marker: false,
    isDOK2Marker: false,
    isDOK3Marker: false,
    isDOK4Marker: false,
    isSourceMarker: false,
    isCategoryMarker: false,
    isPurposeMarker: false,
    extractedUrl: null,
    ...overrides,
  };
}

// ─── findDOK1Nodes ──────────────────────────────────────────────

describe('findDOK1Nodes', () => {
  it('returns empty for empty roots', () => {
    expect(findDOK1Nodes([])).toEqual([]);
  });

  it('finds DOK1 marker at root level', () => {
    const root = makeNode({ id: '1', name: 'DOK1 Facts', isDOK1Marker: true });
    expect(findDOK1Nodes([root])).toHaveLength(1);
    expect(findDOK1Nodes([root])[0].id).toBe('1');
  });

  it('finds DOK1 marker nested 3 levels deep', () => {
    const dok1 = makeNode({ id: '3', name: 'DOK 1', isDOK1Marker: true, depth: 3 });
    const source = makeNode({ id: '2', name: 'Source 1', isSourceMarker: true, depth: 2, children: [dok1] });
    const cat = makeNode({ id: '1', name: 'Category 1', isCategoryMarker: true, depth: 1, children: [source] });
    expect(findDOK1Nodes([cat])).toHaveLength(1);
  });

  it('finds multiple DOK1 markers across branches', () => {
    const dok1a = makeNode({ id: 'a', name: 'DOK 1', isDOK1Marker: true });
    const dok1b = makeNode({ id: 'b', name: 'DOK 1', isDOK1Marker: true });
    const root = makeNode({ id: 'r', name: 'Root', children: [dok1a, dok1b] });
    expect(findDOK1Nodes([root])).toHaveLength(2);
  });

  it('ignores DOK2/Source/Category markers', () => {
    const dok2 = makeNode({ id: 'a', name: 'DOK 2', isDOK2Marker: true });
    const src = makeNode({ id: 'b', name: 'Source 1', isSourceMarker: true });
    const cat = makeNode({ id: 'c', name: 'Category 1', isCategoryMarker: true });
    expect(findDOK1Nodes([dok2, src, cat])).toHaveLength(0);
  });
});

// ─── findDOK2Nodes / findDOK3Nodes / findDOK4Nodes ─────────────

describe('findDOK2Nodes', () => {
  it('returns empty for empty roots', () => {
    expect(findDOK2Nodes([])).toEqual([]);
  });

  it('finds DOK2 marker at any depth', () => {
    const dok2 = makeNode({ id: 'd2', name: 'DOK 2', isDOK2Marker: true, depth: 2 });
    const parent = makeNode({ id: 'p', name: 'Parent', children: [dok2] });
    expect(findDOK2Nodes([parent])).toHaveLength(1);
  });
});

describe('findDOK3Nodes', () => {
  it('returns empty for empty roots', () => {
    expect(findDOK3Nodes([])).toEqual([]);
  });

  it('finds DOK3 marker at any depth', () => {
    const dok3 = makeNode({ id: 'd3', name: 'DOK 3', isDOK3Marker: true, depth: 1 });
    const root = makeNode({ id: 'r', name: 'Root', children: [dok3] });
    expect(findDOK3Nodes([root])).toHaveLength(1);
  });
});

describe('findDOK4Nodes', () => {
  it('returns empty for empty roots', () => {
    expect(findDOK4Nodes([])).toEqual([]);
  });

  it('finds DOK4 marker at any depth', () => {
    const dok4 = makeNode({ id: 'd4', name: 'DOK 4', isDOK4Marker: true, depth: 2 });
    const parent = makeNode({ id: 'p', name: 'Parent', children: [dok4] });
    expect(findDOK4Nodes([parent])).toHaveLength(1);
  });
});

// ─── buildParentMap ─────────────────────────────────────────────

describe('buildParentMap', () => {
  it('returns empty map for empty roots', () => {
    expect(buildParentMap([]).size).toBe(0);
  });

  it('maps root nodes to null', () => {
    const root = makeNode({ id: 'r', name: 'Root' });
    const map = buildParentMap([root]);
    expect(map.get('r')).toBeNull();
  });

  it('maps child to parent', () => {
    const child = makeNode({ id: 'c', name: 'Child' });
    const root = makeNode({ id: 'r', name: 'Root', children: [child] });
    const map = buildParentMap([root]);
    expect(map.get('c')?.id).toBe('r');
  });

  it('maps grandchild chains correctly', () => {
    const grandchild = makeNode({ id: 'gc', name: 'Grandchild' });
    const child = makeNode({ id: 'c', name: 'Child', children: [grandchild] });
    const root = makeNode({ id: 'r', name: 'Root', children: [child] });
    const map = buildParentMap([root]);
    expect(map.get('gc')?.id).toBe('c');
    expect(map.get('c')?.id).toBe('r');
    expect(map.get('r')).toBeNull();
  });
});

// ─── findAncestorContext ────────────────────────────────────────

describe('findAncestorContext', () => {
  it('returns nulls when no markers above DOK1', () => {
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true });
    const root = makeNode({ id: 'r', name: 'Root', children: [dok1] });
    const map = buildParentMap([root]);
    const ctx = findAncestorContext(dok1, map);
    // Root is used as inferred category (fallback)
    expect(ctx.source).toBeNull();
    expect(ctx.sourceUrl).toBeNull();
  });

  it('finds sibling source marker', () => {
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true });
    const source = makeNode({ id: 's', name: 'Source Academic Paper', isSourceMarker: true });
    const parent = makeNode({ id: 'p', name: 'Parent', children: [source, dok1] });
    const map = buildParentMap([parent]);
    const ctx = findAncestorContext(dok1, map);
    expect(ctx.source).toBeTruthy();
  });

  it('finds ancestor category marker', () => {
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true });
    const source = makeNode({ id: 's', name: 'Source 1', isSourceMarker: true, children: [dok1] });
    const cat = makeNode({ id: 'c', name: 'Category Education', isCategoryMarker: true, children: [source] });
    const map = buildParentMap([cat]);
    const ctx = findAncestorContext(dok1, map);
    expect(ctx.category).toContain('Education');
  });

  it('finds both category and source', () => {
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true });
    const source = makeNode({ id: 's', name: 'Source 1', isSourceMarker: true, children: [dok1] });
    const cat = makeNode({ id: 'c', name: 'Category 1 Education', isCategoryMarker: true, children: [source] });
    const map = buildParentMap([cat]);
    const ctx = findAncestorContext(dok1, map);
    expect(ctx.category).toBeTruthy();
    expect(ctx.source).toBeTruthy();
  });

  it('picks up sourceUrl from extractedUrl on source node', () => {
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true });
    const source = makeNode({ id: 's', name: 'Source Paper', isSourceMarker: true, extractedUrl: 'https://example.com/paper', children: [dok1] });
    const map = buildParentMap([source]);
    const ctx = findAncestorContext(dok1, map);
    expect(ctx.sourceUrl).toBe('https://example.com/paper');
  });

  it('picks up sourceUrl from "Link to source" sibling', () => {
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true });
    const link = makeNode({ id: 'l', name: 'Link to source', extractedUrl: 'https://example.com/link' });
    const parent = makeNode({ id: 'p', name: 'Parent', children: [dok1, link] });
    const map = buildParentMap([parent]);
    const ctx = findAncestorContext(dok1, map);
    expect(ctx.sourceUrl).toBe('https://example.com/link');
  });
});

// ─── extractFactsFromHierarchy ──────────────────────────────────

describe('extractFactsFromHierarchy', () => {
  it('returns empty result for empty roots', () => {
    const result = extractFactsFromHierarchy([]);
    expect(result.facts).toEqual([]);
    expect(result.metadata.dok1NodesFound).toBe(0);
  });

  it('extracts facts with correct attribution', () => {
    const fact1 = makeNode({ id: 'f1', name: 'Research shows 80% of students benefit from active learning strategies' });
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true, children: [fact1] });
    const source = makeNode({ id: 's', name: 'Source Active Learning Study', isSourceMarker: true, children: [dok1] });
    const cat = makeNode({ id: 'c', name: 'Category Pedagogy', isCategoryMarker: true, children: [source] });

    const result = extractFactsFromHierarchy([cat]);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].fact).toContain('active learning');
    expect(result.facts[0].source).toContain('Active Learning Study');
  });

  it('skips short text (< 10 chars)', () => {
    const short = makeNode({ id: 'f1', name: 'Too short' });
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true, children: [short] });
    const result = extractFactsFromHierarchy([dok1]);
    expect(result.facts).toHaveLength(0);
  });

  it('recurses into label wrappers for actual content', () => {
    const realFact = makeNode({ id: 'f2', name: 'Studies indicate that spaced repetition improves long-term retention by 40%' });
    const label = makeNode({ id: 'f1', name: 'Fact 1', children: [realFact] });
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true, children: [label] });
    const result = extractFactsFromHierarchy([dok1]);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].fact).toContain('spaced repetition');
  });

  it('extracts grandchild facts', () => {
    const grandchild = makeNode({ id: 'gc', name: 'Additional detail: retention rates doubled in controlled experiments' });
    const fact = makeNode({ id: 'f1', name: 'Main fact about retention rates in educational research studies', children: [grandchild] });
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true, children: [fact] });
    const result = extractFactsFromHierarchy([dok1]);
    expect(result.facts.length).toBeGreaterThanOrEqual(2);
  });

  it('tracks metadata counts correctly', () => {
    const f1 = makeNode({ id: 'f1', name: 'A verified fact about educational outcomes in modern curricula design' });
    const f2 = makeNode({ id: 'f2', name: 'Another fact about student engagement metrics and their correlation with grades' });
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true, children: [f1, f2] });
    const source = makeNode({ id: 's', name: 'Source Study', isSourceMarker: true, children: [dok1] });
    const cat = makeNode({ id: 'c', name: 'Category Research', isCategoryMarker: true, children: [source] });

    const result = extractFactsFromHierarchy([cat]);
    expect(result.metadata.dok1NodesFound).toBe(1);
    expect(result.metadata.totalFactsExtracted).toBe(2);
    expect(result.metadata.sourcesAttributed).toBe(2);
  });

  it('defaults category to General and source to Unknown', () => {
    const fact = makeNode({ id: 'f1', name: 'An isolated fact without any source or category context in the tree' });
    const dok1 = makeNode({ id: 'd', name: 'DOK 1', isDOK1Marker: true, children: [fact] });
    const result = extractFactsFromHierarchy([dok1]);
    expect(result.facts[0].category).toBe('General');
    expect(result.facts[0].source).toBe('Unknown');
  });
});

// ─── extractDOK2Summaries ───────────────────────────────────────

describe('extractDOK2Summaries', () => {
  it('returns empty for no DOK2 nodes', () => {
    expect(extractDOK2Summaries([], [])).toEqual([]);
  });

  it('extracts summary points from DOK2 children', () => {
    const point = makeNode({ id: 'p1', name: 'This source provides evidence that active learning increases engagement scores' });
    const dok2 = makeNode({ id: 'd2', name: 'DOK 2', isDOK2Marker: true, children: [point] });
    const result = extractDOK2Summaries([dok2], []);
    expect(result).toHaveLength(1);
    expect(result[0].points.length).toBeGreaterThanOrEqual(1);
  });

  it('links related DOK1 facts by source', () => {
    const dok1Fact = { id: '1', fact: 'A fact', category: 'General', source: 'Study', sourceUrl: null, depth: 0 };
    const point = makeNode({ id: 'p1', name: 'Summary of the study findings about educational technology impacts' });
    const dok2 = makeNode({ id: 'd2', name: 'DOK 2', isDOK2Marker: true, children: [point] });
    const source = makeNode({ id: 's', name: 'Source Study', isSourceMarker: true, children: [dok2] });

    const result = extractDOK2Summaries([source], [dok1Fact]);
    expect(result[0].relatedDOK1Ids).toContain('1');
  });
});

// ─── extractDOK3Insights ────────────────────────────────────────

describe('extractDOK3Insights', () => {
  it('returns empty for no DOK3 nodes', () => {
    expect(extractDOK3Insights([])).toEqual([]);
  });

  it('treats each child as a separate insight', () => {
    const i1 = makeNode({ id: 'i1', name: 'Cross-source insight: both studies agree on the importance of metacognition' });
    const i2 = makeNode({ id: 'i2', name: 'Another cross-source insight about transfer learning between disciplines' });
    const dok3 = makeNode({ id: 'd3', name: 'DOK 3', isDOK3Marker: true, children: [i1, i2] });
    const result = extractDOK3Insights([dok3]);
    expect(result).toHaveLength(2);
  });

  it('skips marker children', () => {
    const marker = makeNode({ id: 'm', name: 'DOK 1', isDOK1Marker: true });
    const insight = makeNode({ id: 'i1', name: 'A real cross-source insight about pedagogy and curriculum design' });
    const dok3 = makeNode({ id: 'd3', name: 'DOK 3', isDOK3Marker: true, children: [marker, insight] });
    const result = extractDOK3Insights([dok3]);
    expect(result).toHaveLength(1);
  });

  it('skips short text', () => {
    const short = makeNode({ id: 's', name: 'Too short' });
    const dok3 = makeNode({ id: 'd3', name: 'DOK 3', isDOK3Marker: true, children: [short] });
    expect(extractDOK3Insights([dok3])).toHaveLength(0);
  });
});

// ─── extractDOK4SPOVs ───────────────────────────────────────────

describe('extractDOK4SPOVs', () => {
  it('returns empty for no DOK4 nodes', () => {
    expect(extractDOK4SPOVs([])).toEqual([]);
  });

  it('treats each child as a separate SPOV', () => {
    const s1 = makeNode({ id: 's1', name: 'My spiky point of view is that standardized testing fails to measure real learning' });
    const s2 = makeNode({ id: 's2', name: 'Another SPOV: AI tutoring will replace traditional homework within 10 years' });
    const dok4 = makeNode({ id: 'd4', name: 'DOK 4', isDOK4Marker: true, children: [s1, s2] });
    const result = extractDOK4SPOVs([dok4]);
    expect(result).toHaveLength(2);
  });

  it('skips short text', () => {
    const short = makeNode({ id: 's', name: 'Too short' });
    const dok4 = makeNode({ id: 'd4', name: 'DOK 4', isDOK4Marker: true, children: [short] });
    expect(extractDOK4SPOVs([dok4])).toHaveLength(0);
  });
});

// ─── extractAllFromHierarchy ────────────────────────────────────

describe('extractAllFromHierarchy', () => {
  it('returns combined result with all DOK levels', () => {
    const fact = makeNode({ id: 'f1', name: 'Evidence shows formative assessment improves student outcomes significantly' });
    const dok1 = makeNode({ id: 'd1', name: 'DOK 1', isDOK1Marker: true, children: [fact] });
    const point = makeNode({ id: 'p1', name: 'This source demonstrates the value of timely feedback in education' });
    const dok2 = makeNode({ id: 'd2', name: 'DOK 2', isDOK2Marker: true, children: [point] });
    const insight = makeNode({ id: 'i1', name: 'Both studies converge on the importance of formative over summative assessment' });
    const dok3 = makeNode({ id: 'd3', name: 'DOK 3', isDOK3Marker: true, children: [insight] });
    const spov = makeNode({ id: 's1', name: 'My position is that GPA should be replaced by competency-based evaluation systems' });
    const dok4 = makeNode({ id: 'd4', name: 'DOK 4', isDOK4Marker: true, children: [spov] });

    const root = makeNode({ id: 'r', name: 'Root', children: [dok1, dok2, dok3, dok4] });
    const result = extractAllFromHierarchy([root]);

    expect(result.facts.length).toBeGreaterThanOrEqual(1);
    expect(result.dok2Summaries.length).toBeGreaterThanOrEqual(1);
    expect(result.dok3Insights).toHaveLength(1);
    expect(result.dok4SPOVs).toHaveLength(1);
  });

  it('populates all metadata fields', () => {
    const fact = makeNode({ id: 'f1', name: 'A verifiable fact about the correlation between sleep and academic performance' });
    const dok1 = makeNode({ id: 'd1', name: 'DOK 1', isDOK1Marker: true, children: [fact] });
    const result = extractAllFromHierarchy([dok1]);

    expect(result.metadata).toHaveProperty('dok1NodesFound');
    expect(result.metadata).toHaveProperty('dok2NodesFound');
    expect(result.metadata).toHaveProperty('dok3NodesFound');
    expect(result.metadata).toHaveProperty('dok4NodesFound');
    expect(result.metadata).toHaveProperty('totalFactsExtracted');
    expect(result.metadata).toHaveProperty('totalDOK2PointsExtracted');
    expect(result.metadata).toHaveProperty('totalDOK3InsightsExtracted');
    expect(result.metadata).toHaveProperty('totalDOK4SPOVsExtracted');
  });

  it('handles tree with only DOK1', () => {
    const fact = makeNode({ id: 'f1', name: 'Research indicates that homework has diminishing returns past 2 hours per day' });
    const dok1 = makeNode({ id: 'd1', name: 'DOK 1', isDOK1Marker: true, children: [fact] });
    const result = extractAllFromHierarchy([dok1]);
    expect(result.facts).toHaveLength(1);
    expect(result.dok2Summaries).toHaveLength(0);
    expect(result.dok3Insights).toHaveLength(0);
    expect(result.dok4SPOVs).toHaveLength(0);
  });
});

// ─── extractPurposeFromHierarchy ────────────────────────────────

describe('extractPurposeFromHierarchy', () => {
  it('returns null when no Purpose marker exists', () => {
    const root = makeNode({ id: 'r', name: 'Root' });
    expect(extractPurposeFromHierarchy([root])).toBeNull();
  });

  it('extracts first meaningful child as main purpose', () => {
    const purpose = makeNode({
      id: 'p',
      name: 'Purpose',
      isPurposeMarker: true,
      children: [
        makeNode({ id: 'c1', name: 'Explore how active learning strategies can be applied across STEM disciplines' }),
      ],
    });
    const result = extractPurposeFromHierarchy([purpose]);
    expect(result).not.toBeNull();
    expect(result!.mainPurpose).toContain('active learning');
  });

  it('skips In-scope headers', () => {
    const purpose = makeNode({
      id: 'p',
      name: 'Purpose',
      isPurposeMarker: true,
      children: [
        makeNode({ id: 'is', name: 'In-scope' }),
        makeNode({ id: 'c1', name: 'This brainlift explores the relationship between student autonomy and engagement' }),
      ],
    });
    const result = extractPurposeFromHierarchy([purpose]);
    expect(result!.mainPurpose).toContain('autonomy');
  });

  it('skips short children', () => {
    const purpose = makeNode({
      id: 'p',
      name: 'Purpose',
      isPurposeMarker: true,
      children: [
        makeNode({ id: 'short', name: 'TBD' }),
        makeNode({ id: 'real', name: 'Investigate how differentiated instruction impacts diverse learners in K-12' }),
      ],
    });
    const result = extractPurposeFromHierarchy([purpose]);
    expect(result!.mainPurpose).toContain('differentiated');
  });
});

// ─── convertToExtractorFormat ───────────────────────────────────

describe('convertToExtractorFormat', () => {
  it('includes source name and URL when both present', () => {
    const facts = [{ id: '1', fact: 'A fact', category: 'Cat', source: 'Paper', sourceUrl: 'https://example.com', depth: 0 }];
    const result = convertToExtractorFormat(facts);
    expect(result[0].source).toBe('Paper https://example.com');
    expect(result[0].aiNotes).toBe('Source: https://example.com');
  });

  it('includes URL only when source is Unknown', () => {
    const facts = [{ id: '1', fact: 'A fact', category: 'Cat', source: 'Unknown', sourceUrl: 'https://example.com', depth: 0 }];
    const result = convertToExtractorFormat(facts);
    expect(result[0].source).toBe('https://example.com');
  });

  it('includes name only when no URL', () => {
    const facts = [{ id: '1', fact: 'A fact', category: 'Cat', source: 'My Paper', sourceUrl: null, depth: 0 }];
    const result = convertToExtractorFormat(facts);
    expect(result[0].source).toBe('My Paper');
    expect(result[0].aiNotes).toBe('Source: My Paper');
  });

  it('returns null source when Unknown and no URL', () => {
    const facts = [{ id: '1', fact: 'A fact', category: 'Cat', source: 'Unknown', sourceUrl: null, depth: 0 }];
    const result = convertToExtractorFormat(facts);
    expect(result[0].source).toBeNull();
    expect(result[0].aiNotes).toBe('No sources have been linked to this fact');
  });
});
