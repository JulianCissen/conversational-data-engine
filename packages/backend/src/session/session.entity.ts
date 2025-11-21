import { Entity, PrimaryKey, Property, JsonType } from '@mikro-orm/core';

@Entity()
export class Session {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  // This is where the flexible form data lives!
  // MikroORM automatically handles serialization/deserialization
  @Property({ type: JsonType })
  data: Record<string, any> = {};

  @Property()
  status: 'COLLECTING' | 'COMPLETED' = 'COLLECTING';

  // Track which field the user is currently answering
  @Property({ nullable: true })
  currentFieldId?: string;
}