import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL bigint 컬럼은 TypeORM 기본 동작상 문자열로 반환됩니다.
 * 주문번호처럼 JS 안전 정수 범위(<= 9,007,199,254,740,991) 안에서만 쓰는 값은
 * 이 transformer로 숫자(number)로 노출합니다.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null =>
    value === null || value === undefined ? null : Number(value),
};
