import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

type RequestPhoneVerificationBody = {
  phone?: string;
  purpose?: 'signup' | 'recover';
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
  address1?: string;
  address2?: string;
  termsAgreed?: boolean;
  verificationToken?: string;
};

type CheckUserIdBody = {
  userId?: string;
};

type CheckPhoneBody = {
  phone?: string;
};

type LoginBody = {
  userId?: string;
  password?: string;
};

type ProfileBody = {
  userId?: string;
};

type UpdateProfileBody = {
  userId?: string;
  name?: string;
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

type FindUserIdBody = {
  name?: string;
  phone?: string;
  verificationToken?: string;
};

type ResetPasswordBody = {
  userId?: string;
  phone?: string;
  newPassword?: string;
  verificationToken?: string;
};

type ShippingAddressesBody = {
  userId?: string;
};

type ShippingAddressSaveBody = {
  userId?: string;
  id?: number;
  name?: string;
  address1?: string;
  address2?: string;
  isDefault?: boolean;
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

  @Post('check-phone')
  checkPhone(@Body() body: CheckPhoneBody) {
    const phone = body.phone?.trim();

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    return this.authService.checkPhoneAvailability(phone);
  }

  @Post('login')
  login(@Body() body: LoginBody) {
    const userId = body.userId?.trim();
    const password = body.password;

    if (!userId || !password) {
      throw new BadRequestException('아이디와 비밀번호를 입력해주세요.');
    }

    return this.authService.login(userId, password);
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
    const address1 = body.address1?.trim();
    const address2 = body.address2?.trim() ?? '';
    const currentPassword = body.currentPassword;

    if (!userId || !name || !address1 || !currentPassword) {
      throw new BadRequestException('정보수정에 필요한 항목을 모두 입력해주세요.');
    }

    return this.authService.updateProfile({
      userId,
      name,
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

    if (!userId || !password) {
      throw new BadRequestException('탈퇴를 위해 아이디와 비밀번호를 입력해주세요.');
    }

    return this.authService.withdraw({
      userId,
      password,
      reason: body.reason,
    });
  }

  @Post('find-user-id')
  findUserId(@Body() body: FindUserIdBody) {
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const verificationToken = body.verificationToken?.trim();

    if (!name || !phone || !verificationToken) {
      throw new BadRequestException('이름, 전화번호, 문자 인증을 모두 완료해주세요.');
    }

    return this.authService.findUserId({
      name,
      phone,
      verificationToken,
    });
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordBody) {
    const userId = body.userId?.trim();
    const phone = body.phone?.trim();
    const newPassword = body.newPassword;
    const verificationToken = body.verificationToken?.trim();

    if (!userId || !phone || !newPassword || !verificationToken) {
      throw new BadRequestException('아이디, 전화번호, 문자 인증, 새 비밀번호를 입력해주세요.');
    }

    return this.authService.resetPassword({
      userId,
      phone,
      newPassword,
      verificationToken,
    });
  }

  @Post('shipping-addresses')
  shippingAddresses(@Body() body: ShippingAddressesBody) {
    const userId = body.userId?.trim();

    if (!userId) {
      throw new BadRequestException('아이디가 필요합니다.');
    }

    return this.authService.getShippingAddresses(userId);
  }

  @Post('shipping-addresses/save')
  saveShippingAddress(@Body() body: ShippingAddressSaveBody) {
    const userId = body.userId?.trim();
    const name = body.name?.trim();
    const address1 = body.address1?.trim();
    const address2 = body.address2?.trim() ?? '';

    if (!userId || !name || !address1) {
      throw new BadRequestException('배송지 저장에 필요한 정보를 입력해주세요.');
    }

    return this.authService.upsertShippingAddress({
      userId,
      id: typeof body.id === 'number' ? body.id : undefined,
      name,
      address1,
      address2,
      isDefault: body.isDefault === true,
    });
  }

  @Post('phone/request')
  requestPhoneVerification(@Body() body: RequestPhoneVerificationBody) {
    const phone = body.phone?.trim();
    const purpose = body.purpose;

    if (!phone) {
      throw new BadRequestException('전화번호를 입력해주세요.');
    }

    return this.authService.requestPhoneVerification({
      phone,
      purpose: purpose === 'recover' ? 'recover' : 'signup',
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

  @Post('signup')
  signup(@Body() body: SignupBody) {
    const userId = body.userId?.trim();
    const password = body.password;
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const address1 = body.address1?.trim();
    const address2 = body.address2?.trim() ?? '';
    const termsAgreed = body.termsAgreed;
    const verificationToken = body.verificationToken?.trim();

    if (!userId || !password || !name || !phone || !address1 || !verificationToken) {
      throw new BadRequestException('회원가입 정보를 모두 입력해주세요.');
    }

    if (termsAgreed !== true) {
      throw new BadRequestException('약관 동의가 필요합니다.');
    }

    return this.authService.signup({
      userId,
      password,
      name,
      phone,
      address1,
      address2,
      termsAgreed,
      verificationToken,
    });
  }
}
