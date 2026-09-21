import {
  BinaryOperationNode,
  ColumnNode,
  DeleteQueryNode,
  InsertQueryNode,
  OperatorNode,
  PrimitiveValueListNode,
  QueryNode,
  ReferenceNode,
  SelectQueryNode,
  TableNode,
  UpdateQueryNode,
  ValueListNode,
  ValueNode,
  type Insertable,
  type KyselyPlugin,
  type OperationNode,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
} from "kysely";

import type { Executor } from "./connection";
import type { Database } from "./types";

// scoped() -- the only door to a tenant-owned table (ADR-005,
// docs/ENGINEERING/07 "scoped() -- the only door").
//
// The predicate is injected by a Kysely plugin into the *final* query tree,
// at execution time, so it holds by construction:
//   1. a caller cannot obtain an unscoped builder from scoped();
//   2. it applies to SELECT, UPDATE and DELETE alike;
//   3. it cannot be removed downstream -- not by .where(), not by
//      .clearWhere(): the plugin ANDs the tenant (and project) predicate onto
//      whatever the builder produced, so `tenant_id = other` matches nothing;
//   4. INSERT takes tenant_id / project_id from the context, and the plugin
//      rejects any row whose values disagree -- including one built by a
//      caller who chained its own .values();
//   5. the table map below is exhaustive and typed.

/** The scope a query runs in. Built from the verified credential only. */
export type ScopeContext = {
  readonly tenantId: string;
  /** Required for project-owned tables; null for tenant-level operations. */
  readonly projectId: string | null;
};

/** Every tenant-owned table, and whether it is also project-owned (docs/DATABASE/00). */
export const TENANT_OWNED_TABLES = {
  users: { project: false },
  applications: { project: false },
  projects: { project: false },
  role_assignments: { project: false },
  api_keys: { project: false },
  api_key_projects: { project: false },
  webhooks: { project: false },
  webhook_deliveries: { project: false },
  quota_overrides: { project: false },
  audit_logs: { project: false },
  usage: { project: true },
  folders: { project: true },
  assets: { project: true },
  asset_versions: { project: true },
  asset_metadata: { project: true },
  image_derivatives: { project: true },
  tags: { project: true },
  asset_tags: { project: true },
  collections: { project: true },
  collection_assets: { project: true },
} as const satisfies Partial<Record<keyof Database, { project: boolean }>>;

export type TenantOwnedTable = keyof typeof TENANT_OWNED_TABLES;
export type ProjectOwnedTable = {
  [T in TenantOwnedTable]: (typeof TENANT_OWNED_TABLES)[T]["project"] extends true ? T : never;
}[TenantOwnedTable];

/** Raised for a programming error in scoping -- never for a caller's input. */
export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

const equals = (table: string, column: string, value: string): OperationNode =>
  BinaryOperationNode.create(
    ReferenceNode.create(ColumnNode.create(column), TableNode.create(table)),
    OperatorNode.create("="),
    ValueNode.create(value),
  );

/** The value a row supplies for `column`, or `undefined` when it is not a plain value. */
const rowValues = (node: InsertQueryNode, column: string): unknown[] | null => {
  const index = node.columns?.findIndex((c) => c.column.name === column) ?? -1;
  if (index < 0 || !node.values) return null;
  const values = node.values as { readonly values?: readonly OperationNode[] };
  return (values.values ?? []).map((row) => {
    if (PrimitiveValueListNode.is(row)) return row.values[index];
    if (ValueListNode.is(row)) {
      const cell = row.values[index];
      return cell && ValueNode.is(cell) ? cell.value : undefined;
    }
    return undefined;
  });
};

class ScopePlugin implements KyselyPlugin {
  constructor(
    private readonly table: TenantOwnedTable,
    private readonly scope: ScopeContext,
  ) {}

  private get columns(): readonly (readonly [string, string])[] {
    const { tenantId, projectId } = this.scope;
    const project = TENANT_OWNED_TABLES[this.table].project;
    if (project && projectId === null) {
      throw new ScopeError(`scoped(): ${this.table} is project-owned; the context has no project`);
    }
    return project && projectId !== null
      ? [
          ["tenant_id", tenantId],
          ["project_id", projectId],
        ]
      : [["tenant_id", tenantId]];
  }

  transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
    if (SelectQueryNode.is(node) || UpdateQueryNode.is(node) || DeleteQueryNode.is(node)) {
      return this.columns.reduce<typeof node>(
        (acc, [column, value]) => QueryNode.cloneWithWhere(acc, equals(this.table, column, value)),
        node,
      );
    }
    if (InsertQueryNode.is(node)) {
      for (const [column, value] of this.columns) {
        const supplied = rowValues(node, column);
        if (!supplied || supplied.length === 0 || supplied.some((v) => v !== value)) {
          throw new ScopeError(
            `scoped(): insert into ${this.table} must carry the context's ${column}`,
          );
        }
      }
      return node;
    }
    throw new ScopeError(`scoped(): unsupported statement on ${this.table}`);
  }

  transformResult({ result }: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(result);
  }
}

/**
 * The caller's insert values: everything but the scope columns. project_id is
 * a scope column only on project-owned tables; on api_key_projects and
 * role_assignments it is data (which project a key or a grant covers).
 */
type ScopedValues<T extends TenantOwnedTable> = Omit<
  Insertable<Database[T]>,
  T extends ProjectOwnedTable ? "tenant_id" | "project_id" : "tenant_id"
>;

/**
 * The scoped query entry points for one context. Every builder it returns
 * carries the scope plugin; there is no method that returns a bare one.
 */
export const scoped = (executor: Executor, scope: ScopeContext) => {
  const withScope = (table: TenantOwnedTable) => executor.withPlugin(new ScopePlugin(table, scope));
  const stamp = <T extends TenantOwnedTable>(table: T, values: ScopedValues<T>) => {
    // Context last: a payload-supplied tenant_id or project_id is overwritten.
    const scopeColumns = TENANT_OWNED_TABLES[table].project
      ? { tenant_id: scope.tenantId, project_id: scope.projectId }
      : { tenant_id: scope.tenantId };
    return { ...values, ...scopeColumns } as unknown as Insertable<Database[T]>;
  };

  return {
    selectFrom: <T extends TenantOwnedTable>(table: T) => withScope(table).selectFrom(table),
    updateTable: <T extends TenantOwnedTable>(table: T) => withScope(table).updateTable(table),
    deleteFrom: <T extends TenantOwnedTable>(table: T) => withScope(table).deleteFrom(table),
    insertInto: <T extends TenantOwnedTable>(
      table: T,
      values: ScopedValues<T> | readonly ScopedValues<T>[],
    ) =>
      withScope(table)
        .insertInto(table)
        .values(
          Array.isArray(values)
            ? (values as readonly ScopedValues<T>[]).map((v) => stamp(table, v))
            : stamp(table, values as ScopedValues<T>),
        ),
  };
};

/**
 * Why a caller may cross tenants. A closed union: a new reason is a
 * reviewed change (docs/ENGINEERING/07 "The escape hatch").
 */
export type UnscopedReason =
  /** Find a credential by its public id before any tenant is known. */
  | "authenticate-credential"
  /** Batch-write last_used_at for credentials seen by this process. */
  | "record-credential-use"
  | "tenant-provisioning"
  | "usage-aggregation"
  | "retention-purge"
  | "admin-api";

/**
 * Bypasses tenant scoping. Deliberately ugly and greppable. Banned by lint
 * in services and module repositories; each call site states its reason in
 * the type and carries the checks docs/ENGINEERING/07 requires.
 */
export const unsafeUnscoped = (executor: Executor, _reason: UnscopedReason): Executor => executor;
