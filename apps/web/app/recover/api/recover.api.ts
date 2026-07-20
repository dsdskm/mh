export function throwLegacyRecoverRemoved(): never {
  throw new Error("계정 복구 기능이 제거되었습니다. 카카오 로그인만 지원합니다.");
}
