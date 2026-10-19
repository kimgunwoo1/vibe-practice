// docs/의 PDF를 잘게 나누고 임베딩해서 MongoDB Atlas Vector Search에 넣는다.
//
//   npm run ingest              # docs/*.pdf 전부
//   npm run ingest -- <파일>    # 특정 파일만
//   npm run ingest -- --dry-run # 나누기만 하고 결과를 보여 줌 (API 키·DB 불필요)
//
// 같은 문서를 다시 넣으면 그 문서의 예전 조각을 지우고 새로 넣는다.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { DOCS_INDEX, EMBEDDING_DIMENSION, embed, getVectorStore } from "../mastra/rag";
import { chunkPages, cleanPages, parseFileName } from "./chunk";

// npm run ingest는 ai-chat 폴더에서 실행된다
const DOCS_DIR = path.resolve("docs");
// 무료 등급은 분당 요청·토큰 수가 적어서 조금씩 보내고, 한도에 걸리면 기다렸다가 다시 보낸다
const BATCH_SIZE = 20;
const RETRY_WAIT_MS = 60_000;
const MAX_RETRIES = 5;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// package.json이 CommonJS라서 최상위 await 대신 main()으로 감싼다
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArgs = args.filter((a) => !a.startsWith("--")).map((a) => path.basename(a));
  const files = fileArgs.length
    ? fileArgs
    : (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".pdf")).sort();

  if (!files.length) {
    console.log("docs/에 PDF가 없습니다.");
    return;
  }

  if (!dryRun) {
    const missing = ["MONGODB_URI", "GOOGLE_GENERATIVE_AI_API_KEY"].filter((k) => !process.env[k]);
    if (missing.length) {
      console.error(`.env.local에 ${missing.join(", ")} 값을 넣어 주세요.`);
      process.exit(1);
    }
  }

  const store = dryRun ? null : getVectorStore();
  if (store && !(await store.listIndexes()).includes(DOCS_INDEX)) {
    console.log(`벡터 인덱스 '${DOCS_INDEX}'를 만듭니다. (처음 한 번, 1~2분 걸릴 수 있음)`);
    await store.createIndex({
      indexName: DOCS_INDEX,
      dimension: EMBEDDING_DIMENSION,
      metric: "cosine",
      filterFields: ["domain"],
    });
    await store.waitForIndexReady({ indexName: DOCS_INDEX, timeoutMs: 300_000 });
  }

  for (const file of files) {
    const info = parseFileName(file);
    if (!info) {
      console.warn(`건너뜀: ${file} (이름이 '<activity|work>-<연도>-<문서 이름>.pdf' 형식이 아님)`);
      continue;
    }

    const pdf = await getDocumentProxy(new Uint8Array(await readFile(path.join(DOCS_DIR, file))));
    const { text } = await extractText(pdf, { mergePages: false });
    // 표가 있는 쪽은 convert-tables로 줄글로 바꿔 둔 텍스트를 쓴다 (키: PDF 쪽 번호)
    const convertedFile = path.join(DOCS_DIR, "converted", file.replace(/\.pdf$/, ".json"));
    const converted: Record<string, { text: string }> = existsSync(convertedFile)
      ? JSON.parse(await readFile(convertedFile, "utf8"))
      : {};
    const pages = cleanPages(text).map((p, i) =>
      p.text && converted[i + 1] ? { ...p, text: converted[i + 1].text } : p,
    );
    const chunks = await chunkPages(pages, info);
    console.log(
      `${file}: ${text.length}쪽(표 정리 ${Object.keys(converted).length}쪽) → 조각 ${chunks.length}개`,
    );

    if (!store) {
      for (const c of chunks.slice(0, 3)) console.log(`\n[${c.page}쪽]\n${c.text.slice(0, 300)}…`);
      continue;
    }

    await store.deleteVectors({ indexName: DOCS_INDEX, filter: { source: info.source } });
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await withRetry(() => embed(batch.map((c) => c.text), "RETRIEVAL_DOCUMENT"));
      await store.upsert({
        indexName: DOCS_INDEX,
        vectors,
        metadata: batch,
        ids: batch.map((_, j) => `${file}#${i + j}`),
      });
      console.log(`  ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);
    }
  }

  await store?.disconnect();
  console.log("끝났습니다.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status !== 429 || attempt >= MAX_RETRIES) throw err;
      console.log(`  요청 한도에 걸려 ${RETRY_WAIT_MS / 1000}초 기다립니다…`);
      await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
    }
  }
}
