import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository, type SelectQueryBuilder } from 'typeorm';
import { ActivityLogService, columnChanges } from '../activity-log/activity-log.service.js';
import { assetUrl } from '../common/asset-url.js';
import { laravelPaginated } from '../common/laravel-pagination.js';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { deletePublicFile, storedPath } from '../common/public-storage.js';
import { requestContext } from '../common/request-context.js';
import { slugify } from '../common/slug.js';
import { adminPage, orNotFound } from '../store-admin/admin-page.js';
import { BlogPost } from './blog-post.entity.js';

export interface BlogPostForm {
  title: string;
  excerpt: string | null;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  status: boolean;
  publishedAt: Date | null;
}

/** Parses the multipart blog form with Laravel's validation rules and messages. */
export function parseBlogForm(body: Record<string, string | undefined>): BlogPostForm {
  const errors: Record<string, string[]> = {};
  const text = (value: string | undefined) => (value && value.trim() ? value.trim() : null);
  const maxLength = (field: string, label: string, value: string | null, max: number) => {
    if (value && value.length > max) errors[field] = [`The ${label} field must not be greater than ${max} characters.`];
  };

  const title = text(body.title);
  if (!title) errors.title = ['The title field is required.'];
  maxLength('title', 'title', title, 255);

  const excerpt = text(body.excerpt);
  maxLength('excerpt', 'excerpt', excerpt, 500);

  const content = body.content ?? '';
  if (!content.replace(/<[^>]*>/g, '').trim() && !/<img/i.test(content))
    errors.content = ['The content field is required.'];

  const metaTitle = text(body.metaTitle);
  maxLength('metaTitle', 'meta title', metaTitle, 255);
  const metaDescription = text(body.metaDescription);
  maxLength('metaDescription', 'meta description', metaDescription, 500);

  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
  if (publishedAt && Number.isNaN(publishedAt.getTime()))
    errors.publishedAt = ['The published at field must be a valid date.'];

  if (Object.keys(errors).length) throw new LaravelValidationException(errors);

  return {
    title: title as string,
    excerpt,
    content,
    metaTitle,
    metaDescription,
    status: body.status === 'true' || body.status === '1',
    publishedAt,
  };
}

/** BlogPost::published() - live, and not scheduled for later. */
function published(query: SelectQueryBuilder<BlogPost>) {
  return query.where('p.status = 1').andWhere(
    new Brackets((q) => {
      q.where('p.published_at IS NULL').orWhere('p.published_at <= :now', { now: new Date() });
    }),
  );
}

const summary = (p: BlogPost) => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt,
  featured_image: assetUrl(p.featuredImage),
  published_at: p.publishedAt?.toISOString() ?? null,
});

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost) private readonly posts: Repository<BlogPost>,
    private readonly activity: ActivityLogService,
  ) {}

  // ---------------------------------------------------------------- admin

  private present(post: BlogPost) {
    return { ...post, featuredImageUrl: assetUrl(post.featuredImage) };
  }

  async findAll(page: number) {
    const perPage = 15;
    const [rows, total] = await this.posts.findAndCount({
      relations: { user: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return adminPage(
      rows.map((p) => ({ ...this.present(p), user: p.user ? { id: p.user.id, name: p.user.name } : null })),
      total,
      page,
      perPage,
    );
  }

  async findOne(id: number) {
    return this.present(await this.get(id));
  }

  async create(form: BlogPostForm, image?: Express.Multer.File) {
    const post = await this.posts.save(
      this.posts.create({
        ...form,
        slug: await this.uniqueSlug(form.title),
        featuredImage: image ? storedPath('blog', image) : null,
        userId: requestContext()?.adminId ?? null,
        // Publishing without a date means "now".
        publishedAt: form.status && !form.publishedAt ? new Date() : form.publishedAt,
      }),
    );
    await this.activity.record(
      'created',
      { model: 'BlogPost', id: post.id, label: post.title },
      `Created blog post "${post.title}"`,
    );
    return this.present(post);
  }

  async update(id: number, form: BlogPostForm, image?: Express.Multer.File) {
    const post = await this.get(id);
    const before = { ...post };
    const oldImage = post.featuredImage;

    Object.assign(post, form);
    if (form.title !== before.title) post.slug = await this.uniqueSlug(form.title, id);
    // Keep the original publish date unless one was given; first publish stamps now.
    if (!form.publishedAt) post.publishedAt = form.status && !before.publishedAt ? new Date() : before.publishedAt;
    if (image) post.featuredImage = storedPath('blog', image);

    const saved = await this.posts.save(post);
    if (image) await deletePublicFile(oldImage);
    await this.activity.record(
      'updated',
      { model: 'BlogPost', id: saved.id, label: saved.title },
      `Updated blog post "${saved.title}"`,
      columnChanges(this.posts, before, saved, ['updated_at']),
    );
    return this.present(saved);
  }

  async remove(id: number) {
    const post = await this.get(id);
    await this.posts.delete(post.id);
    await deletePublicFile(post.featuredImage);
    await this.activity.record('deleted', null, `Deleted blog post "${post.title}"`);
  }

  private async get(id: number) {
    return orNotFound(await this.posts.findOneBy({ id }), 'Blog post');
  }

  private async uniqueSlug(title: string, ignoreId?: number) {
    const base = slugify(title) || 'post';
    let slug = base;
    for (let i = 2; await this.posts.existsBy({ slug, ...(ignoreId ? { id: Not(ignoreId) } : {}) }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  // --------------------------------------------------------------- public

  /** Api\V1\BlogController@index - published posts, 9 per page, Laravel's paginator shape. */
  async publicIndex(page: number) {
    const perPage = 9;
    const [rows, total] = await published(this.posts.createQueryBuilder('p'))
      .orderBy('p.published_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();
    return laravelPaginated(rows.map(summary), { page, perPage, total, path: '/api/v1/blog' });
  }

  /** Api\V1\BlogController@show - one published post plus three related. */
  async publicShow(slug: string) {
    const post = await published(this.posts.createQueryBuilder('p')).andWhere('p.slug = :slug', { slug }).getOne();
    if (!post) throw new NotFoundException('Blog post not found.');
    const related = await published(this.posts.createQueryBuilder('p'))
      .andWhere('p.id != :id', { id: post.id })
      .orderBy('p.published_at', 'DESC')
      .take(3)
      .getMany();
    return {
      data: {
        ...summary(post),
        content: post.content,
        meta_title: post.metaTitle,
        meta_description: post.metaDescription,
        related_posts: related.map(summary),
      },
    };
  }
}
