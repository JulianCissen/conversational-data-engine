import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Prompt {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ unique: true })
  key!: string;

  @Property({ type: 'text' })
  value!: string;

  @Property()
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
