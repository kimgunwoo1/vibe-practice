import { handle } from "hono/vercel";
import { app } from "@/server/app";

// 모든 /api/* 요청을 Hono 앱으로 넘긴다
export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
