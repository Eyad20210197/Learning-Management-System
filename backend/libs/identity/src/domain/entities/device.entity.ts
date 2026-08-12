export interface DeviceProperties {
  id: string;
  clientDeviceId: string;
  name: string;
  browser: string | null;
  operatingSystem: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

export class Device {
  constructor(private readonly properties: DeviceProperties) {}

  get id(): string {
    return this.properties.id;
  }
  get clientDeviceId(): string {
    return this.properties.clientDeviceId;
  }
  get name(): string {
    return this.properties.name;
  }
  get browser(): string | null {
    return this.properties.browser;
  }
  get operatingSystem(): string | null {
    return this.properties.operatingSystem;
  }
  get firstSeenAt(): Date {
    return this.properties.firstSeenAt;
  }
  get lastSeenAt(): Date {
    return this.properties.lastSeenAt;
  }
  get revokedAt(): Date | null {
    return this.properties.revokedAt;
  }
}
