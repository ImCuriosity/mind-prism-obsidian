// ============================================================================
// 데이터 파싱 로직
// 옵시디언 볼트의 노드(파일)·엣지(위키링크)·프론트매터를 읽어
// PARA 카테고리로 분류하고, 위상 정렬 기반의 계층형 트리로 변환합니다.
// ============================================================================

import type { App, CachedMetadata, TFile } from "obsidian";
import {
  ALL_CATEGORIES,
  CATEGORY_LABEL,
  GraphLink,
  GraphNode,
  ParaCategory,
  PARA_CATEGORIES,
  TreeNode,
  VaultGraphData,
} from "./types";

/**
 * 프론트매터 type/category 값 또는 태그를 PARA 카테고리로 정규화합니다.
 * 단·복수형, 한글 별칭 등 흔한 표기를 함께 매핑합니다.
 */
const CATEGORY_ALIASES: Record<string, ParaCategory> = {
  // Projects
  project: "projects",
  projects: "projects",
  프로젝트: "projects",
  // Areas
  area: "areas",
  areas: "areas",
  영역: "areas",
  // Resources
  resource: "resources",
  resources: "resources",
  자료: "resources",
  리소스: "resources",
  // Archives
  archive: "archives",
  archives: "archives",
  보관: "archives",
  아카이브: "archives",
};

/**
 * 단일 문자열을 PARA 카테고리로 변환합니다. 매칭 실패 시 null.
 */
function normalizeCategory(raw: unknown): ParaCategory | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/^#/, "");
  return CATEGORY_ALIASES[key] ?? null;
}

/**
 * 한 파일의 메타데이터(프론트매터 + 태그)를 보고 카테고리를 판별합니다.
 * 우선순위: frontmatter.type → frontmatter.category → 태그(#project 등).
 * 무엇에도 해당하지 않으면 'unsorted'.
 */
function classifyFile(cache: CachedMetadata | null): ParaCategory {
  if (!cache) return "unsorted";

  const fm = cache.frontmatter;
  if (fm) {
    // type 속성은 문자열 또는 배열일 수 있습니다.
    for (const field of [fm.type, fm.category, fm.para]) {
      if (Array.isArray(field)) {
        for (const v of field) {
          const c = normalizeCategory(v);
          if (c) return c;
        }
      } else {
        const c = normalizeCategory(field);
        if (c) return c;
      }
    }
  }

  // 본문/프론트매터 태그를 확인합니다. (getAllTags가 #를 포함해 반환)
  const tags = collectTags(cache);
  for (const tag of tags) {
    const c = normalizeCategory(tag);
    if (c) return c;
  }

  return "unsorted";
}

/**
 * 프론트매터 tags 및 인라인 태그를 한데 모읍니다.
 * getAllTags 대신 캐시를 직접 읽어 의존성을 줄였습니다.
 */
function collectTags(cache: CachedMetadata): string[] {
  const out: string[] = [];
  if (cache.tags) {
    for (const t of cache.tags) out.push(t.tag);
  }
  const fmTags = cache.frontmatter?.tags;
  if (Array.isArray(fmTags)) {
    for (const t of fmTags) if (typeof t === "string") out.push(t);
  } else if (typeof fmTags === "string") {
    // "a, b" 또는 "a b" 형태 모두 분해
    out.push(...fmTags.split(/[,\s]+/));
  }
  return out;
}

/**
 * 볼트 전체를 파싱하여 그래프 데이터(노드/엣지/트리)를 생성합니다.
 *
 * @param app 옵시디언 App 인스턴스
 * @returns 노드, 엣지, 계층형 트리를 담은 VaultGraphData
 */
export function parseVault(app: App): VaultGraphData {
  const files: TFile[] = app.vault.getMarkdownFiles();

  // ---- 1) 노드 생성 + 카테고리 분류 ----------------------------------------
  const nodeMap = new Map<string, GraphNode>();
  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    nodeMap.set(file.path, {
      id: file.path,
      name: file.basename,
      category: classifyFile(cache),
      degree: 0,
    });
  }

  // ---- 2) 엣지 생성 (resolvedLinks: { src: { dst: count } }) ---------------
  const links: GraphLink[] = [];
  const resolved = app.metadataCache.resolvedLinks;
  for (const src of Object.keys(resolved)) {
    if (!nodeMap.has(src)) continue;
    for (const dst of Object.keys(resolved[src])) {
      // 마크다운 파일 노드끼리의 링크만 채택(첨부파일 등 제외)
      if (!nodeMap.has(dst) || src === dst) continue;
      links.push({ source: src, target: dst });
      // 무방향 차수 누적(노드 크기 산정용)
      nodeMap.get(src)!.degree += 1;
      nodeMap.get(dst)!.degree += 1;
    }
  }

  const nodes = Array.from(nodeMap.values());

  // ---- 3) 위상 정렬 기반 계층형 트리 구성 ----------------------------------
  const tree = buildTree(nodes, links);

  return { nodes, links, tree };
}

/**
 * 카테고리별 가상 루트를 최상위로 두고, 각 카테고리 내부에서는
 * 링크 방향(부모→자식)을 따라 BFS로 부모-자식 관계를 확정합니다.
 *
 * - 같은 카테고리 안에서 들어오는 링크가 없는 노드(in-degree 0)를 루트로 봅니다.
 * - 사이클이 있거나 모든 노드가 서로를 참조해 루트가 없으면, 남은 노드를
 *   임의로 루트화하여 누락을 방지합니다.
 * - visited 집합으로 순회하므로 사이클이 있어도 무한루프/중복이 없습니다.
 */
function buildTree(nodes: GraphNode[], links: GraphLink[]): TreeNode[] {
  // 카테고리 → 해당 노드 id 목록
  const byCategory = new Map<ParaCategory, string[]>();
  for (const cat of ALL_CATEGORIES) byCategory.set(cat, []);
  const catOf = new Map<string, ParaCategory>();
  for (const n of nodes) {
    byCategory.get(n.category)!.push(n.id);
    catOf.set(n.id, n.category);
  }

  // 같은 카테고리 내부의 인접 리스트(부모→자식)와 in-degree 계산
  const children = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    children.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const link of links) {
    const s = typeof link.source === "string" ? link.source : link.source.id;
    const t = typeof link.target === "string" ? link.target : link.target.id;
    if (catOf.get(s) === catOf.get(t)) {
      children.get(s)!.push(t);
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
  }

  const nameOf = new Map<string, string>();
  for (const n of nodes) nameOf.set(n.id, n.name);

  const roots: TreeNode[] = [];

  // 카테고리별로 트리를 만든다(unsorted 포함, 표시 순서 고정)
  for (const cat of [...PARA_CATEGORIES, "unsorted" as ParaCategory]) {
    const memberIds = byCategory.get(cat)!;
    if (memberIds.length === 0) continue;

    const memberSet = new Set(memberIds);
    const visited = new Set<string>();

    // BFS로 자식 노드를 붙이는 헬퍼(사이클 방지)
    const buildSubtree = (id: string): TreeNode => {
      visited.add(id);
      const node: TreeNode = {
        id,
        name: nameOf.get(id) ?? id,
        category: cat,
        children: [],
        isCategoryRoot: false,
      };
      for (const childId of children.get(id) ?? []) {
        if (!memberSet.has(childId) || visited.has(childId)) continue;
        node.children.push(buildSubtree(childId));
      }
      return node;
    };

    // in-degree 0 노드를 우선 루트로 사용
    const localRoots: TreeNode[] = [];
    for (const id of memberIds) {
      if ((inDegree.get(id) ?? 0) === 0 && !visited.has(id)) {
        localRoots.push(buildSubtree(id));
      }
    }
    // 사이클 등으로 미방문 노드가 남으면 임의 루트화
    for (const id of memberIds) {
      if (!visited.has(id)) localRoots.push(buildSubtree(id));
    }

    // 카테고리 가상 루트로 묶기
    roots.push({
      id: `__category__${cat}`,
      name: CATEGORY_LABEL[cat],
      category: cat,
      children: localRoots,
      isCategoryRoot: true,
    });
  }

  return roots;
}
