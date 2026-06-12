# 프로젝트 요약: 옵시디언 다중 투사 및 동적 군집화 뷰어 플러그인

이 문서는 AI 코딩 어시스턴트(Claude)가 옵시디언 커스텀 플러그인을 바닥부터 구축하기 위한 시스템 컨텍스트 및 요구사항 명세서입니다. 이 문서를 읽고 단계별로 플러그인 스캐폴딩 및 타입스크립트 코딩을 진행해 주십시오.

<context>
사용자는 텍스트 위주의 평면적인 노트 관리에 한계를 느끼고 있습니다. 무정형으로 흩어진 지식 노드(마크다운 파일)와 엣지(위키링크)를 목적에 맞게 'PARA 형태의 계층형 트리'로 정리해서 보여주고, 동시에 시각적 그래프의 인력(Force)을 조작하여 트리 구조에 맞게 그래프가 '동적 군집(Cluster)'을 형성하는 하이브리드 뷰어 플러그인을 개발하고자 합니다.
</context>

<requirements>
1. 데이터 파싱 로직 (Data Parsing)
- 옵시디언 내장 API인 app.metadataCache.resolvedLinks 와 getFileCache 를 사용하여 볼트 내의 파일(노드)과 연결 상태(엣지), 그리고 프론트매터(YAML) 메타데이터를 추출해야 합니다.
- 추출한 데이터를 기반으로 부모-자식 관계를 판별하는 위상 정렬 로직을 작성하십시오. 프론트매터의 type 속성이나 tag(예: #project, #area)를 루트 노드로 삼아 트리를 구성합니다.

2. 하이브리드 UI 레이아웃 (Workspace Leaf)
- 플러그인 실행 시 우측 사이드바(ItemView)에 커스텀 뷰를 렌더링합니다.
- 뷰어의 상단에는 모드 전환 버튼(예: "무정형 모드", "PARA 분류 모드")을 배치합니다.
- 화면을 좌우 또는 상하로 분할하여 한쪽에는 '계층형 텍스트 트리(HTML ul/li 구조)'를 렌더링하고, 다른 한쪽에는 D3.js 기반의 '커스텀 인터랙티브 그래프 캔버스'를 렌더링합니다.

3. 동적 군집화 그래프 엔진 (D3.js Force Simulation)
- 옵시디언의 기본 내장 그래프는 물리 엔진 조작이 불가능하므로, 플러그인 UI 내부에 d3-force를 활용한 독자적인 그래프 뷰어를 구축합니다.
- "무정형 모드"에서는 일반적인 중앙 집중형 반발력(forceManyBody, forceCenter)을 적용합니다.
- "PARA 분류 모드" 전환 시, 트리의 최상위 카테고리(Projects, Areas, Resources, Archives) 개수만큼 화면에 가상의 좌표(중력점)를 생성합니다.
- 각 노드가 속한 카테고리를 판별하여, 노드들이 자신에게 할당된 중력점을 향해 끌려가는 인력(forceX, forceY) 애니메이션을 구현하십시오. 
</requirements>

<tech_stack>
- TypeScript
- Obsidian Plugin API (obsidian 라이브러리)
- D3.js (npm install d3, @types/d3)
- esbuild (빌드 시스템)
</tech_stack>

<execution_steps>
지시를 받은 즉시 아래 단계를 순차적으로 실행하여 코드를 작성하십시오.

1. 플러그인 뼈대 생성: manifest.json, package.json, tsconfig.json, esbuild.config.mjs 파일을 생성하고 d3 라이브러리를 의존성에 추가하십시오.
2. 메인 엔트리: main.ts 를 생성하고 Plugin 클래스와 ItemView 클래스를 상속받는 기본 구조를 작성하십시오.
3. 데이터 변환 로직 구현: 볼트의 마크다운 링크 데이터를 읽어 계층형 JSON 객체로 변환하는 헬퍼 함수를 구현하십시오.
4. D3 그래프 연동: ItemView의 DOM 엘리먼트 안에 svg 캔버스를 띄우고, 모드 전환 상태에 따라 force 시뮬레이션 파라미터가 동적으로 변하는 코드를 구현하십시오.
</execution_steps>

<constraints>
- 옵시디언 API의 비동기 처리(async/await) 규칙을 엄격히 준수하십시오.
- 옵시디언 모바일 앱에서도 동작할 수 있도록 UI는 반응형으로 구성하십시오.
- 코드를 작성할 때 각 기능 블록(캐시 읽기, 트리 렌더링, D3 렌더링)에 상세한 주석을 달아 사용자가 유지보수하기 쉽게 만드십시오.
</constraints>