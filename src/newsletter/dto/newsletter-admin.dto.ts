import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class NewsletterMessageDto {
  @MaxLength(255, { message: 'The subject field must not be greater than 255 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'The subject field is required.' })
  subject: string;

  /** HTML from the admin's rich-text editor. */
  @IsString()
  @IsNotEmpty({ message: 'The body field is required.' })
  body: string;
}
