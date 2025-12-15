import { IsInt, Min, IsOptional, IsString } from 'class-validator';

export class FundWalletDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;
}
