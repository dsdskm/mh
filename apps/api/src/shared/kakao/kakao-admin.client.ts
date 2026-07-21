export type KakaoAdminAction = 'unlink' | 'logout';

export type KakaoAdminActionResponse = {
  id?: number;
  msg?: string;
  code?: number;
};

export type KakaoAdminActionResult = {
  status: number;
  ok: boolean;
  data: KakaoAdminActionResponse;
};

const KAKAO_ADMIN_ACTION_ENDPOINT: Record<KakaoAdminAction, string> = {
  unlink: 'https://kapi.kakao.com/v1/user/unlink',
  logout: 'https://kapi.kakao.com/v1/user/logout',
};

export async function postKakaoAdminUserAction(input: {
  action: KakaoAdminAction;
  providerUserId: string;
  kakaoAdminKey: string;
}): Promise<KakaoAdminActionResult> {
  const response = await fetch(KAKAO_ADMIN_ACTION_ENDPOINT[input.action], {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${input.kakaoAdminKey}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({
      target_id_type: 'user_id',
      target_id: input.providerUserId,
    }).toString(),
  });

  const data = (await response.json().catch(() => ({}))) as KakaoAdminActionResponse;

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}
