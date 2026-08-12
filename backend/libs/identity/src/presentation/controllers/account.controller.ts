import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ListDevicesUseCase, RevokeDeviceUseCase } from '../../application';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import {
  DevicePresenter,
  type DeviceResponse,
} from '../presenters/device.presenter';
import { UserPresenter, type UserResponse } from '../presenters/user.presenter';

@Controller({ path: 'me', version: '1' })
@UseGuards(AccessTokenGuard)
export class AccountController {
  constructor(
    private readonly listDevices: ListDevicesUseCase,
    private readonly revokeDevice: RevokeDeviceUseCase,
  ) {}

  @Get() getMe(@Req() request: AuthenticatedRequest): UserResponse {
    return UserPresenter.toResponse(request.auth.user);
  }

  @Get('devices') async devices(
    @Req() request: AuthenticatedRequest,
  ): Promise<DeviceResponse[]> {
    return (await this.listDevices.execute(request.auth.user.id)).map(
      (device) => DevicePresenter.toResponse(device),
    );
  }

  @Delete('devices/:deviceId')
  @HttpCode(204)
  async removeDevice(
    @Req() request: AuthenticatedRequest,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ): Promise<void> {
    await this.revokeDevice.execute(request.auth.user.id, deviceId);
  }
}
