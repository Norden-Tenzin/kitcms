// Sequential hook runners for collection-level and field-level hooks.

import type { FieldHookArgs, KitcmsReq, Operation } from '../config/hooks';
import type { SanitizedField } from '../config/sanitized';
import { traverseFields } from '../fields/traverse';

/**
 * Runs hooks in order. A hook returning something other than `undefined` replaces `args[key]` for
 * the next hook (each hook receives a shallow copy of args with the updated key). Returns the final
 * value.
 */
export async function runHooks<A extends object, K extends keyof A>(
	hooks: readonly ((args: A) => unknown)[],
	args: A,
	key: K,
): Promise<A[K]> {
	let current = args;
	for (const hook of hooks) {
		const result = await hook(current);
		if (result !== undefined) current = { ...current, [key]: result as A[K] };
	}
	return current[key];
}

export type FieldHookPhase = 'beforeValidate' | 'beforeChange' | 'afterChange' | 'afterRead';

/**
 * Runs the field-level hooks of `phase` over `data`, mutating it in place. Containers run before
 * their children. A non-undefined return replaces `siblingData[field.name]` and the next hook's
 * `value`.
 */
export async function runFieldHooks(
	phase: FieldHookPhase,
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
	args: { req: KitcmsReq; operation: Operation; originalDoc?: Record<string, unknown> },
): Promise<void> {
	await traverseFields(fields, data, async ({ field, siblingData }) => {
		for (const hook of field.hooks[phase]) {
			const hookArgs: FieldHookArgs<unknown> = {
				req: args.req,
				operation: args.operation,
				originalDoc: args.originalDoc,
				value: siblingData[field.name],
				data,
				siblingData,
			};
			const result = await hook(hookArgs);
			if (result !== undefined) siblingData[field.name] = result;
		}
	});
}
