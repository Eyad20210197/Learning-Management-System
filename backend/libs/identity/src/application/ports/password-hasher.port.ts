export interface PasswordHasherPort {
  hash(plainText: string): Promise<string>;
  verify(hash: string, plainText: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('identity.password-hasher');
