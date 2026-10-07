import {
  type EntitySubscriberInterface,
  EventSubscriber,
  type InsertEvent,
  type ObjectLiteral,
  type UpdateEvent,
} from 'typeorm';

/**
 * Eloquent's timestamps: Laravel's tables give `created_at` / `updated_at` no
 * database default, so fill them on insert (and touch `updated_at` on save)
 * for every entity that maps those columns. Values set explicitly win.
 */
@EventSubscriber()
export class LaravelTimestampsSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<ObjectLiteral>) {
    if (!event.entity) return;
    const now = new Date();
    for (const column of event.metadata.columns) {
      if (
        column.databaseName !== 'created_at' &&
        column.databaseName !== 'updated_at'
      )
        continue;
      if (column.getEntityValue(event.entity) == null)
        column.setEntityValue(event.entity, now);
    }
  }

  beforeUpdate(event: UpdateEvent<ObjectLiteral>) {
    if (!event.entity) return;
    const column = event.metadata.columns.find(
      (c) => c.databaseName === 'updated_at',
    );
    if (column && !column.isUpdateDate)
      column.setEntityValue(event.entity, new Date());
  }
}
