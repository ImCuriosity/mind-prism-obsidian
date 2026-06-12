# Mind Prism 플러그인 핵심 아키텍처 및 렌더링 지시서

이 문서는 Mind Prism 옵시디언 플러그인의 데이터 렌더링 목적과 UI 구조화 방식, 그리고 Anthropic API 연동 파이프라인을 명확히 하기 위한 핵심 논리 명세서입니다. 기존의 단순 나열식 텍스트 출력을 폐기하고, 아래의 AI 기반 구조화 로직을 따라 코드를 리팩토링하십시오.

<plugin_purpose>
본 플러그인은 일회성 텍스트 문서를 생성하는 스크립트가 아닙니다. 사용자의 옵시디언 우측 사이드바(ItemView)에 상시 띄워져 있는 하이브리드 인터랙티브 뷰어입니다. 
뷰어는 다음의 역할을 수행합니다.
1. Anthropic API(Claude)를 활용한 지식 그래프 의미론적 분석 및 계층화
2. 좌측 영역: AI가 반환한 구조화 데이터를 개요서 형태의 HTML 트리(ul/li) UI로 렌더링
3. 우측 영역: D3.js 기반의 동적 군집화 그래프 렌더링
</plugin_purpose>

<ai_intervention_pipeline>
옵시디언의 단순 링크 데이터를 의미론적 트리로 변환하기 위해 Anthropic API를 파이프라인 중간에 개입시킵니다.

1. 로컬 데이터 수집: app.metadataCache.resolvedLinks 와 getFileCache 를 스캔하여 노트 제목, 링크 관계, 프론트매터 데이터를 수집하여 하나의 Raw JSON 객체로 만듭니다.
2. AI 프롬프트 전송: 수집된 Raw JSON 데이터를 Anthropic API(예: Claude 3.5 Sonnet)로 전송합니다. 시스템 프롬프트에는 "제공된 마크다운 노트 간의 연결망과 메타데이터를 분석하여, Tiago Forte의 PARA(Projects, Areas, Resources, Archives) 방법론에 맞춘 엄격한 계층형 JSON 구조로 재조립하고, 노드 간의 의미론적 연관도 스코어(0~1)를 부여하라"는 지시를 포함하십시오.
3. 데이터 수신: AI가 응답한 계층화된 JSON 데이터를 파싱하여 이후 렌더링 로직의 상태(State) 값으로 저장합니다. (보안을 위해 플러그인 설정 창에 Anthropic API Key를 입력받는 UI를 구현해야 합니다.)
</ai_intervention_pipeline>

<tree_structuring_logic>
AI가 반환한 JSON 구조체를 바탕으로 DOM 엘리먼트를 생성합니다.

1. DOM 렌더링 방식: 단순한 텍스트 문자열(String) 조합이 아니라, document.createElement를 활용하여 렌더링합니다.
2. 부모 노드(예: 특정 Project)는 최상단 li 요소로, 자식 노드들은 그 하위의 ul > li 요소로 들여쓰기(Padding)가 적용된 아웃라인 UI로 구성하십시오.
</tree_structuring_logic>

<d3_force_dynamics>
AI가 분석한 위계와 연관도 스코어를 D3 그래프의 물리 엔진에 반영합니다.

1. 다중 중력점(Force Centers) 생성: AI가 분류한 최상위 카테고리(루트 노드) 개수만큼 D3 svg 캔버스 공간을 분할하여 보이지 않는 가상의 중력점 좌표(x, y)를 할당합니다.
2. 인력 및 반발력 적용: 자식 노드들은 트리 구조상 자신이 속한 루트 노드의 중력점 좌표를 향해 끌려가도록 forceX 와 forceY를 세팅합니다. 또한 AI가 부여한 '의미론적 연관도 스코어'를 링크의 인력(distance, strength) 파라미터에 매핑하여, 연관도가 높은 노드일수록 시각적으로 더 가깝게 뭉치도록 군집(Cluster) 애니메이션을 구현하십시오.
</d3_force_dynamics>

<action_items>
위 논리를 바탕으로 기존 main.ts 의 로직을 전면 리팩토링하십시오. 
1. 플러그인 설정(Settings) 탭을 추가하여 사용자가 Anthropic API Key를 안전하게 입력하고 저장할 수 있도록 구현할 것.
2. 로컬 캐시 스캔 -> AI API 호출 -> 트리 UI 렌더링 및 D3 캔버스 렌더링으로 이어지는 비동기(async/await) 파이프라인을 구축할 것.
3. D3 캔버스와 트리 UI가 좌우 또는 상하로 분할되어 한 화면에 보이도록 ItemView 레이아웃을 구성할 것.
</action_items>