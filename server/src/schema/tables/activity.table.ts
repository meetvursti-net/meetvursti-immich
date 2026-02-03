import { UpdatedAtTrigger, UpdateIdColumn } from 'src/decorators';
import { AlbumAssetTable } from 'src/schema/tables/album-asset.table';
import { AlbumTable } from 'src/schema/tables/album.table';
import { AssetTable } from 'src/schema/tables/asset.table';
import { UserTable } from 'src/schema/tables/user.table';
import {
  Check,
  Column,
  CreateDateColumn,
  ForeignKeyColumn,
  ForeignKeyConstraint,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  Table,
  Timestamp,
  UpdateDateColumn,
} from 'src/sql-tools';

@Table('activity')
@UpdatedAtTrigger('activity_updatedAt')
// Unique index for reactions (emoji or like) per user per asset/album combination
@Index({
  name: 'activity_reaction_idx',
  columns: ['assetId', 'userId', 'albumId', 'reaction'],
  unique: true,
  where: '(reaction IS NOT NULL)',
})
// Legacy index for likes (backwards compatibility)
@Index({
  name: 'activity_like_idx',
  columns: ['assetId', 'userId', 'albumId'],
  unique: true,
  where: '("isLiked" = true AND reaction IS NULL)',
})
// Index for parent lookups (replies and comment reactions)
@Index({
  name: 'activity_parent_idx',
  columns: ['parentId'],
})
// Index for asset-level activities without album
@Index({
  name: 'activity_asset_only_idx',
  columns: ['assetId'],
  where: '("albumId" IS NULL)',
})
@Check({
  name: 'activity_type_check',
  expression: `(
    (comment IS NOT NULL AND reaction IS NULL AND "isLiked" = false) OR
    (comment IS NULL AND reaction IS NOT NULL AND "isLiked" = false) OR
    (comment IS NULL AND reaction IS NULL AND "isLiked" = true)
  )`,
})
// Only enforce album-asset FK when albumId is not null
@ForeignKeyConstraint({
  columns: ['albumId', 'assetId'],
  referenceTable: () => AlbumAssetTable,
  referenceColumns: ['albumId', 'assetId'],
  onUpdate: 'NO ACTION',
  onDelete: 'CASCADE',
})
export class ActivityTable {
  @PrimaryGeneratedColumn()
  id!: Generated<string>;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;

  // Made nullable to support asset-only activities (without album context)
  @ForeignKeyColumn(() => AlbumTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: true })
  albumId!: string | null;

  @ForeignKeyColumn(() => UserTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  userId!: string;

  @ForeignKeyColumn(() => AssetTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: true })
  assetId!: string | null;

  // Self-referential FK for replies to comments and reactions to comments
  @ForeignKeyColumn(() => ActivityTable, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: true })
  parentId!: string | null;

  @Column({ type: 'text', default: null })
  comment!: string | null;

  // Emoji reaction (e.g., '👍', '❤️', '😂')
  @Column({ type: 'character varying', length: 32, default: null })
  reaction!: string | null;

  // Legacy field for backwards compatibility - new reactions should use 'reaction' column
  @Column({ type: 'boolean', default: false })
  isLiked!: Generated<boolean>;

  // Timestamp for when a comment was last edited
  @Column({ type: 'timestamp with time zone', default: null })
  editedAt!: Timestamp | null;

  @UpdateIdColumn({ index: true })
  updateId!: Generated<string>;
}
