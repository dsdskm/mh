import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

type RequestPhoneVerificationBody = {
  phone?: string;
};

type VerifyPhoneCodeBody = {
  phone?: string;
  code?: string;
};

type SignupBody = {
  userId?: string;
  password?: string;
  name?: string;
  phone?: string;
  address?: string;
  verificationToken?: string;
};

type CheckUserIdBody = {
  userId?: string;
};

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('check-user-id')
  checkUserId(@Body() body: CheckUserIdBody) {
    const userId = body.userId?.trim();

    if (!userId) {
      throw new BadRequestException('아이디를 입력해주세요.');
    }

    return this.authService.checkUserIdAvailability(userId);
  }

  @Post('phone/request')
  requestPhoneVerification(@Body() body: RequestPhoneVerificationBody) {
    const phone = body.phone?.trim();

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    return this.authService.requestPhoneVerification({ phone });
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

  @Post('signup')
  signup(@Body() body: SignupBody) {
    const userId = body.userId?.trim();
    const password = body.password;
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const address = body.address?.trim();
    const verificationToken = body.verificationToken?.trim();

    if (!userId || !password || !name || !phone || !address || !verificationToken) {
      throw new BadRequestException('회원가입 정보를 모두 입력해주세요.');
    }

    return this.authService.signup({
      userId,
      password,
      name,
      phone,
      address,
      verificationToken,
    });
  }
}
