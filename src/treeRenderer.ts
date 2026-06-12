// ============================================================================
// 계층형 텍스트 트리 렌더러
// 파싱된 TreeNode[] 를 HTML <ul>/<li> 구조로 그립니다.
// 카테고리 루트는 색상 배지로 강조하고, 노드 클릭 시 콜백을 호출합니다.
// ============================================================================

import { CATEGORY_COLOR, TreeNode } from "./types";

/** 트리 노드 클릭 콜백(파일 노드만 id 전달). */
export type TreeClickHandler = (id: string) => void;

/**
 * 트리 데이터를 컨테이너에 렌더링합니다.
 *
 * @param container 렌더 대상 엘리먼트(기존 내용은 비워집니다)
 * @param tree 카테고리 루트 배열
 * @param onClick 파일 노드 클릭 콜백
 */
export function renderTree(
  container: HTMLElement,
  tree: TreeNode[],
  onClick: TreeClickHandler
): void {
  container.empty();

  if (tree.length === 0) {
    container.createEl("div", {
      cls: "para-tree-empty",
      text: "표시할 노트가 없습니다. 볼트에 마크다운 파일을 추가해 보세요.",
    });
    return;
  }

  const rootUl = container.createEl("ul", { cls: "para-tree-root" });
  for (const node of tree) {
    renderNode(rootUl, node, onClick);
  }
}

/**
 * 단일 TreeNode를 <li>로 렌더링하고, 자식이 있으면 재귀적으로 중첩 <ul>을 만듭니다.
 */
function renderNode(
  parentUl: HTMLUListElement,
  node: TreeNode,
  onClick: TreeClickHandler
): void {
  const li = parentUl.createEl("li", { cls: "para-tree-item" });

  // 라벨 행(색 점 + 이름)
  const label = li.createEl("div", {
    cls: node.isCategoryRoot
      ? "para-tree-label para-tree-category"
      : "para-tree-label",
  });

  // 카테고리 색상 점
  const dot = label.createEl("span", { cls: "para-tree-dot" });
  dot.style.backgroundColor = CATEGORY_COLOR[node.category];

  label.createEl("span", {
    cls: "para-tree-name",
    text: node.name,
  });

  // 파일 노드는 클릭하면 콜백 호출(노트 열기)
  if (!node.isCategoryRoot) {
    label.addEventListener("click", () => onClick(node.id));
  } else {
    // 카테고리 루트는 자식 개수 배지를 표시
    label.createEl("span", {
      cls: "para-tree-count",
      text: String(countLeaves(node)),
    });
  }

  // 자식 렌더링
  if (node.children.length > 0) {
    const childUl = li.createEl("ul", { cls: "para-tree-children" });
    for (const child of node.children) {
      renderNode(childUl, child, onClick);
    }
  }
}

/** 카테고리 루트 하위의 파일 노드 총 개수를 셉니다(배지용). */
function countLeaves(node: TreeNode): number {
  let count = node.isCategoryRoot ? 0 : 1;
  for (const child of node.children) count += countLeaves(child);
  return count;
}
