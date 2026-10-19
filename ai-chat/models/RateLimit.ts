import mongoose, { Schema, type InferSchemaType } from "mongoose";

// 요청 횟수 카운터. key = "<종류>:<익명ID 또는 IP>:<시간 창>"
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  // 이 시각이 지나면 MongoDB가 문서를 자동으로 지운다 (TTL 인덱스)
  expiresAt: { type: Date, required: true, expires: 0 },
});

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema>;

// 핫 리로드 때 같은 모델을 다시 등록하면 오류가 나므로 있으면 재사용
export const RateLimit =
  mongoose.models.RateLimit || mongoose.model("RateLimit", rateLimitSchema);
