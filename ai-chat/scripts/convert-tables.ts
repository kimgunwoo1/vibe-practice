// 표가 있는 쪽을 Claude에게 PDF 쪽 그대로 보여 주고, 표를 줄글로 풀어 쓴 텍스트를 받아 저장한다.
// PDF 표를 글자로만 뽑으면 열이 한 칸씩 밀려 다른 구간의 금액을 답할 수 있기 때문이다.
//
//   npm run convert-tables                  # docs/*.pdf의 표 쪽 중 아직 안 바꾼 쪽
//   npm run convert-tables -- --pages 78,79 # 특정 PDF 쪽만 (다시) 바꾸기
//   npm run convert-tables -- --list        # 표 쪽으로 고른 쪽만 보여 줌 (API 호출 없음)
//
// 결과는 docs/converted/<PDF 이름>.json에 PDF 쪽 번호별로 쌓인다. 이 파일은 git에 올리고,
// npm run ingest가 해당 쪽은 원래 뽑은 글자 대신 이 텍스트를 쓴다.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { cleanPages, hasTable } from "./chunk";

const DOCS_DIR = path.resolve("docs");
const OUT_DIR = path.join(DOCS_DIR, "converted");
const MODEL = "claude-opus-5-5";
const CONCURRENCY = 4;

const SYSTEM = `
한국 정부 사업안내 PDF의 한 쪽을 검색용 텍스트로 옮깁니다. 결과는 다른 AI가 사용자 질문에 답할 때 근거로 읽습니다.

- 쪽의 내용을 빠짐없이 옮깁니다. 표가 아닌 글은 글자를 바꾸지 말고 그대로 옮깁니다.
- 표는 칸마다 그 칸의 행 머리글과 열 머리글을 붙여 한 줄씩 풀어 씁니다. 표 제목(예: 【활동지원급여에 대한 본인부담금】)을 먼저 쓰고 그 아래에 줄을 둡니다.
  예: 15구간(월 한도액 1,040천원) / 기준중위소득 70% 이하(본인부담률 4%): 41,600원
- 병합된 칸은 해당하는 모든 줄에 같은 값을 붙입니다. 빈칸이나 "-"는 "-"로 적습니다.
- 숫자는 계산하거나 고치지 말고 표에 적힌 그대로 씁니다. 표 아래 ※ 주석도 그대로 옮깁니다.
- 그림이나 흐름도는 단계와 주체가 드러나게 순서대로 글로 씁니다.
- 쪽 위아래의 머리글(문서 제목)과 쪽 번호는 뺍니다.
- 설명이나 인사 없이 옮긴 텍스트만 출력합니다.
`.trim();

type Converted = Record<string, { page: string; text: string }>;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes("--list");
  const pagesArg = args[args.indexOf("--pages") + 1];
  const onlyPages = args.includes("--pages") ? new Set(pagesArg.split(",").map(Number)) : null;

  if (!listOnly && !process.env.ANTHROPIC_API_KEY) {
    console.error(".env.local에 ANTHROPIC_API_KEY 값을 넣어 주세요.");
    process.exit(1);
  }
  const client = new Anthropic();
  await mkdir(OUT_DIR, { recursive: true });

  for (const file of (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".pdf")).sort()) {
    const bytes = await readFile(path.join(DOCS_DIR, file));
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: false });
    const pages = cleanPages(text);
    const outFile = path.join(OUT_DIR, file.replace(/\.pdf$/, ".json"));
    const converted: Converted = existsSync(outFile) ? JSON.parse(await readFile(outFile, "utf8")) : {};

    // PDF 쪽 번호(1부터)
    const targets = pages
      .map((p, i) => ({ pdfPage: i + 1, page: p.page, text: p.text }))
      .filter((p) => (onlyPages ? onlyPages.has(p.pdfPage) : hasTable(p.text) && !converted[p.pdfPage]));

    console.log(`${file}: 바꿀 쪽 ${targets.length}개 (이미 바꾼 쪽 ${Object.keys(converted).length}개)`);
    if (listOnly) {
      console.log(targets.map((t) => `${t.pdfPage}(${t.page}쪽)`).join(" "));
      continue;
    }

    const source = await PDFDocument.load(bytes);
    let done = 0;
    let failed = 0;
    const queue = [...targets];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let t = queue.shift(); t; t = queue.shift()) {
          try {
            converted[t.pdfPage] = { page: t.page, text: await convertPage(client, source, t.pdfPage) };
            // 중간에 멈춰도 바꾼 쪽은 남도록 한 쪽마다 저장한다
            await writeFile(outFile, JSON.stringify(sortByPage(converted), null, 2) + "\n");
            done++;
          } catch (err) {
            failed++;
            console.warn(`  ${t.pdfPage}쪽 실패: ${(err as Error).message}`);
          }
          console.log(`  ${done + failed}/${targets.length}`);
        }
      }),
    );
    console.log(`  완료 ${done}쪽, 실패 ${failed}쪽 → ${path.relative(process.cwd(), outFile)}`);
  }
}

async function convertPage(client: Anthropic, source: PDFDocument, pdfPage: number) {
  const single = await PDFDocument.create();
  const [copied] = await single.copyPages(source, [pdfPage - 1]);
  single.addPage(copied);
  const data = Buffer.from(await single.save()).toString("base64");

  const message = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      // 거절(refusal)되면 서버가 다른 모델로 이어서 처리한다
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
            { type: "text", text: "이 쪽을 규칙에 따라 옮겨 주세요." },
          ],
        },
      ],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") throw new Error("모델이 처리를 거절함");
  if (message.stop_reason === "max_tokens") throw new Error("출력이 너무 길어 잘림");
  const text = message.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error("빈 응답");
  return text;
}

function sortByPage(converted: Converted): Converted {
  return Object.fromEntries(Object.entries(converted).sort(([a], [b]) => Number(a) - Number(b)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
