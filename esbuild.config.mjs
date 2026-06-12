import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
이 파일은 esbuild로 생성된 번들 결과물입니다. 직접 수정하지 마십시오.
원본 소스는 main.ts 등 .ts 파일을 참고하세요.
*/`;

// production 인자 유무로 워치 모드 / 1회 빌드를 구분합니다.
const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["main.ts"],
  bundle: true,
  // obsidian API, electron, codemirror 패키지 및 node 내장 모듈은 번들에서 제외합니다.
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
