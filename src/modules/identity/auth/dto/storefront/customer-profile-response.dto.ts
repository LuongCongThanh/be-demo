import { ApiProperty } from '@nestjs/swagger';

export class CustomerProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: ['vi', 'en'] })
  interfaceLocale: 'vi' | 'en';

  @ApiProperty({ enum: ['vi', 'en'] })
  emailLocale: 'vi' | 'en';
}
