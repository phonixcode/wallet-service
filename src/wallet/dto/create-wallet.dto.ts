import { IsIn } from 'class-validator';

export class CreateWalletDto {
  @IsIn(['USD'])
  currency: string;
}
