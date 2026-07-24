import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

type RequestPhoneVerificationBody = {
  phone?: string;
  purpose?: 'signup';
};

type VerifyPhoneCodeBody = {
  phone?: string;
  code?: string;
};

type KakaoLoginBody = {
  code?: string;
  redirectUri?: string;
};

type KakaoLogoutBody = {
  userId?: string;
};

type ProfileBody = {
  userId?: string;
};

type UpdateProfileBody = {
  userId?: string;
  name?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  currentPassword?: string;
  newPassword?: string;
};

type WithdrawBody = {
  userId?: string;
  password?: string;
  reason?: string;
};

type KakaoCompleteProfileBody = {
  userId?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
};

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('kakao/login')
  kakaoLogin(@Body() body: KakaoLoginBody) {
    const code = body.code?.trim();
    const redirectUri = body.redirectUri?.trim();

    console.info('[auth:kakao] request body', {
      rawBody: body,
      code,
      redirectUri,
    });

    if (!code || !redirectUri) {
      throw new BadRequestException('카카오 로그인에 필요한 정보가 누락되었습니다.');
    }

    return this.authService.loginWithKakaoCode({
      code,
      redirectUri,
    });
  }

  @Post('kakao/logout')
  kakaoLogout(@Body() body: KakaoLogoutBody) {
    const userId = body.userId?.trim();

    if (!userId) {
      throw new BadRequestException('카카오 로그아웃에 필요한 정보가 누락되었습니다.');
    }

    return this.authService.logoutKakao(userId);
  }

  @Post('profile')
  profile(@Body() body: ProfileBody) {
    const userId = body.userId?.trim();

    if (!userId) {
      throw new BadRequestException('아이디가 필요합니다.');
    }

    return this.authService.getProfile(userId);
  }

  @Post('profile/update')
  updateProfile(@Body() body: UpdateProfileBody) {
    const userId = body.userId?.trim();
    const name = body.name?.trim();
    const postalCode = body.postalCode?.trim();
    const address1 = body.address1?.trim();
    const address2 = body.address2?.trim() ?? '';
    const currentPassword = body.currentPassword;

    if (!userId || !name || !address1) {
      throw new BadRequestException('정보수정에 필요한 항목을 모두 입력해주세요.');
    }

    return this.authService.updateProfile({
      userId,
      name,
      postalCode,
      address1,
      address2,
      currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Post('withdraw')
  withdraw(@Body() body: WithdrawBody) {
    const userId = body.userId?.trim();
    const password = body.password;

    if (!userId) {
      throw new BadRequestException('탈퇴를 위해 아이디가 필요합니다.');
    }

    return this.authService.withdraw({
      userId,
      password,
      reason: body.reason,
    });
  }

  @Post('kakao/complete-profile')
  completeKakaoProfile(@Body() body: KakaoCompleteProfileBody) {
    const userId = body.userId?.trim();
    const postalCode = body.postalCode?.trim();
    const address1 = body.address1?.trim();
    const address2 = body.address2?.trim() ?? '';

    if (!userId || !postalCode || !address1) {
      throw new BadRequestException('카카오 회원 추가정보를 모두 입력해주세요.');
    }

    return this.authService.completeKakaoProfile({
      userId,
      postalCode,
      address1,
      address2,
    });
  }

  @Post('phone/request')
  requestPhoneVerification(@Body() body: RequestPhoneVerificationBody) {
    const phone = body.phone?.trim();

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    return this.authService.requestPhoneVerification({
      phone,
      purpose: 'signup',
    });
  }

  @Post('phone/verify')
  verifyPhoneCode(@Body() body: VerifyPhoneCodeBody) {
    const phone = body.phone?.trim();
    const code = body.code?.trim();

    if (!phone || !code) {
      throw new BadRequestException('전화번호와 인증번호를 모두 입력해주세요.');
    }

    return this.authService.verifyPhoneCode({ phone, code });
  }
}
