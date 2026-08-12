import type { Device } from '../../domain';

export interface DeviceResponse {
  id: string;
  clientDeviceId: string;
  name: string;
  browser: string | null;
  operatingSystem: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  revoked: boolean;
}

export class DevicePresenter {
  static toResponse(device: Device): DeviceResponse {
    return {
      id: device.id,
      clientDeviceId: device.clientDeviceId,
      name: device.name,
      browser: device.browser,
      operatingSystem: device.operatingSystem,
      firstSeenAt: device.firstSeenAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      revoked: device.revokedAt !== null,
    };
  }
}
