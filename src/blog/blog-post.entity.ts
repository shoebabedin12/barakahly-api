import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity('blog_posts')
export class BlogPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  excerpt: string | null;

  @Column({ type: 'longtext' })
  content: string;

  @Column({ name: 'featured_image', type: 'varchar', nullable: true })
  featuredImage: string | null;

  @Column({ name: 'meta_title', type: 'varchar', nullable: true })
  metaTitle: string | null;

  @Column({ name: 'meta_description', type: 'varchar', nullable: true })
  metaDescription: string | null;

  @Column({ type: 'boolean', default: false })
  status: boolean;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
