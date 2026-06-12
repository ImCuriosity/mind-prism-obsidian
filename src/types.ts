// ============================================================================
// 공용 타입 정의
// 데이터 파싱 / 트리 렌더링 / D3 그래프 엔진이 공유하는 데이터 모델입니다.
// ============================================================================

import type { SimulationNodeDatum, SimulationLinkDatum } from "d3";

/**
 * PARA 분류 카테고리.
 * 'unsorted'는 어떤 카테고리에도 분류되지 못한 무정형 노드를 담는 버킷입니다.
 */
export type ParaCategory =
  | "projects"
  | "areas"
  | "resources"
  | "archives"
  | "unsorted";

/** 화면에 표시할 4대 PARA 카테고리 순서(좌상→우상→좌하→우하 배치에 사용). */
export const PARA_CATEGORIES: ParaCategory[] = [
  "projects",
  "areas",
  "resources",
  "archives",
];

/** 모든 카테고리(unsorted 포함). */
export const ALL_CATEGORIES: ParaCategory[] = [
  ...PARA_CATEGORIES,
  "unsorted",
];

/** 카테고리별 표시 라벨. */
export const CATEGORY_LABEL: Record<ParaCategory, string> = {
  projects: "Projects",
  areas: "Areas",
  resources: "Resources",
  archives: "Archives",
  unsorted: "Unsorted",
};

/** 카테고리별 색상(트리/그래프 공통 사용). */
export const CATEGORY_COLOR: Record<ParaCategory, string> = {
  projects: "#e06c75", // 빨강 계열
  areas: "#61afef", // 파랑 계열
  resources: "#98c379", // 초록 계열
  archives: "#c678dd", // 보라 계열
  unsorted: "#9aa0aa", // 회색 계열
};

/**
 * 그래프 노드.
 * d3 SimulationNodeDatum를 확장하므로 시뮬레이션 도중 x, y, vx, vy, fx, fy가
 * 런타임에 추가됩니다.
 */
export interface GraphNode extends SimulationNodeDatum {
  /** 파일 경로(고유 식별자). */
  id: string;
  /** 파일명(확장자 제외, 표시용). */
  name: string;
  /** 분류된 PARA 카테고리. */
  category: ParaCategory;
  /** 같은 카테고리 내 연결 차수(노드 크기 계산용). */
  degree: number;
}

/**
 * 그래프 엣지(위키링크).
 * source/target은 파싱 시점엔 문자열 id, 시뮬레이션 시작 후엔 GraphNode 참조가 됩니다.
 */
export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

/**
 * 계층형 텍스트 트리 노드(HTML ul/li 렌더링용).
 */
export interface TreeNode {
  id: string;
  name: string;
  category: ParaCategory;
  /** 자식 노드 목록. */
  children: TreeNode[];
  /** 카테고리 가상 루트인지 여부(실제 파일이 아님). */
  isCategoryRoot: boolean;
}

/**
 * 파싱 결과 묶음. 그래프 엔진과 트리 렌더러가 함께 사용합니다.
 */
export interface VaultGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  /** 카테고리 가상 루트들을 최상위로 갖는 트리(PARA 모드 트리뷰용). */
  tree: TreeNode[];
}

/** 뷰어 모드. */
export type ViewMode = "amorphous" | "para";
